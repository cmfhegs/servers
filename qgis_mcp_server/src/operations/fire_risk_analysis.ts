/**
 * Fire Risk Analysis Operations for MCP Server
 * 
 * This module implements fire risk analysis operations that communicate with the QGIS container
 * to assess wildfire risk based on vegetation, topography, climate, and human factors.
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import QGISConnector from '../qgis_connector.js';

// Define parameter types
export interface FireRiskParams {
  dem_path: string;
  output_path: string;
  land_cover_path?: string;
  vegetation_path?: string;
  climate_data?: {
    temperature?: string;
    precipitation?: string;
    wind?: string;
    humidity?: string;
  };
  human_factors?: {
    population_density?: string;
    infrastructure?: string;
    ignition_points?: string;
  };
  historical_fires?: string;
  seasonal_adjustment?: number; // 0-1 value representing dry season severity
  wind_factor?: number; // 0-1 value representing wind influence on fire spread
  risk_thresholds?: {
    low: number;
    moderate: number;
    high: number;
    extreme: number;
  };
}

export interface FireRiskResponse {
  risk_layer: string;
  hazard_zones: string;
  defensible_space: string;
  evacuation_routes?: string;
  statistics: {
    high_risk_area_ha: number;
    moderate_risk_area_ha: number;
    low_risk_area_ha: number;
    total_area_ha: number;
    risk_index: number; // 0-1 composite risk score for the entire area
    population_at_risk?: number;
  };
  categories: {
    name: string;
    area: number;
    percentage: number;
    color: string;
  }[];
  metadata: {
    analysis_timestamp: string;
    data_used: string[];
    algorithm_version: string;
  };
}

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'fire-risk-analysis' },
  transports: [
    new winston.transports.File({ filename: 'fire-risk-analysis-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'fire-risk-analysis.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Data directory configuration
const DATA_DIR = process.env.QGIS_DATA_DIR || path.join(process.cwd(), 'data');
const OUTPUT_DIR = process.env.QGIS_OUTPUT_DIR || path.join(process.cwd(), 'output');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  try {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    logger.info(`Created output directory: ${OUTPUT_DIR}`);
  } catch (error) {
    logger.error('Failed to create output directory', { error: (error as Error).message });
  }
}

/**
 * Executes fire risk analysis using the QGIS server
 * @param params - Fire risk analysis parameters
 * @returns Analysis results
 */
export async function fireRiskAnalysis(params: FireRiskParams): Promise<FireRiskResponse> {
  try {
    // Input validation
    if (!params.dem_path) {
      throw new McpError(
        ErrorCode.InvalidParameters,
        'Missing required parameter: dem_path'
      );
    }

    if (!params.output_path) {
      throw new McpError(
        ErrorCode.InvalidParameters,
        'Missing required parameter: output_path'
      );
    }

    // Resolve paths
    const demPath = path.isAbsolute(params.dem_path) 
      ? params.dem_path 
      : path.join(DATA_DIR, params.dem_path);
      
    const outputPath = path.isAbsolute(params.output_path)
      ? params.output_path
      : path.join(OUTPUT_DIR, params.output_path);

    // Ensure DEM file exists
    if (!fs.existsSync(demPath)) {
      throw new McpError(
        ErrorCode.InvalidParameters,
        `DEM file not found: ${demPath}`
      );
    }

    // Process land cover path
    let landCoverPath = null;
    if (params.land_cover_path) {
      landCoverPath = path.isAbsolute(params.land_cover_path)
        ? params.land_cover_path
        : path.join(DATA_DIR, params.land_cover_path);
      
      if (!fs.existsSync(landCoverPath)) {
        logger.warn(`Land cover file not found: ${landCoverPath}`);
        landCoverPath = null;
      }
    }

    // Process vegetation path
    let vegetationPath = null;
    if (params.vegetation_path) {
      vegetationPath = path.isAbsolute(params.vegetation_path)
        ? params.vegetation_path
        : path.join(DATA_DIR, params.vegetation_path);
      
      if (!fs.existsSync(vegetationPath)) {
        logger.warn(`Vegetation file not found: ${vegetationPath}`);
        vegetationPath = null;
      }
    }

    // Process climate data paths
    const climateData: Record<string, string | null> = {
      temperature: null,
      precipitation: null,
      wind: null,
      humidity: null
    };

    if (params.climate_data) {
      for (const [key, value] of Object.entries(params.climate_data)) {
        if (value) {
          const dataPath = path.isAbsolute(value)
            ? value
            : path.join(DATA_DIR, value);
          
          if (fs.existsSync(dataPath)) {
            climateData[key] = dataPath;
          } else {
            logger.warn(`Climate data file not found: ${dataPath}`);
          }
        }
      }
    }

    // Process human factors paths
    const humanFactors: Record<string, string | null> = {
      population_density: null,
      infrastructure: null,
      ignition_points: null
    };

    if (params.human_factors) {
      for (const [key, value] of Object.entries(params.human_factors)) {
        if (value) {
          const dataPath = path.isAbsolute(value)
            ? value
            : path.join(DATA_DIR, value);
          
          if (fs.existsSync(dataPath)) {
            humanFactors[key] = dataPath;
          } else {
            logger.warn(`Human factor file not found: ${dataPath}`);
          }
        }
      }
    }

    // Process historical fires path
    let historicalFiresPath = null;
    if (params.historical_fires) {
      historicalFiresPath = path.isAbsolute(params.historical_fires)
        ? params.historical_fires
        : path.join(DATA_DIR, params.historical_fires);
      
      if (!fs.existsSync(historicalFiresPath)) {
        logger.warn(`Historical fires file not found: ${historicalFiresPath}`);
        historicalFiresPath = null;
      }
    }

    // Validate seasonal adjustment
    const seasonalAdjustment = params.seasonal_adjustment !== undefined
      ? params.seasonal_adjustment
      : 0.5; // Default to moderate

    if (seasonalAdjustment < 0 || seasonalAdjustment > 1) {
      throw new McpError(
        ErrorCode.InvalidParameters,
        'Seasonal adjustment must be between 0 and 1'
      );
    }

    // Validate wind factor
    const windFactor = params.wind_factor !== undefined
      ? params.wind_factor
      : 0.5; // Default to moderate

    if (windFactor < 0 || windFactor > 1) {
      throw new McpError(
        ErrorCode.InvalidParameters,
        'Wind factor must be between 0 and 1'
      );
    }

    // Verify risk thresholds
    const defaultThresholds = {
      low: 0.25,
      moderate: 0.5,
      high: 0.75,
      extreme: 0.9
    };

    const riskThresholds = params.risk_thresholds || defaultThresholds;

    // Prepare request payload
    const requestData = {
      dem_path: demPath,
      output_path: outputPath,
      land_cover_path: landCoverPath,
      vegetation_path: vegetationPath,
      climate_data: climateData,
      human_factors: humanFactors,
      historical_fires: historicalFiresPath,
      seasonal_adjustment: seasonalAdjustment,
      wind_factor: windFactor,
      risk_thresholds: riskThresholds
    };

    // Execute request
    logger.info('Performing fire risk analysis', { params: requestData });
    
    // Call QGIS server via connector
    const response = await QGISConnector.performFireRiskAnalysis(requestData);
    
    if (!response.success) {
      throw new McpError(
        ErrorCode.InternalError,
        `Fire risk analysis failed: ${response.error?.message || 'Unknown error'}`
      );
    }
    
    // Construct list of data sources used
    const dataUsed = [params.dem_path];
    if (params.land_cover_path) dataUsed.push(params.land_cover_path);
    if (params.vegetation_path) dataUsed.push(params.vegetation_path);
    if (params.historical_fires) dataUsed.push(params.historical_fires);
    
    if (params.climate_data) {
      Object.values(params.climate_data).forEach(path => {
        if (path) dataUsed.push(path);
      });
    }
    
    if (params.human_factors) {
      Object.values(params.human_factors).forEach(path => {
        if (path) dataUsed.push(path);
      });
    }
    
    return {
      ...(response.data as any),
      metadata: {
        ...(response.data as any).metadata,
        data_used: dataUsed.map(d => path.basename(d))
      }
    };
  } catch (error) {
    logger.error('Error in fire risk analysis', { 
      error: (error as Error).message, 
      stack: (error as Error).stack 
    });
    
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Fire risk analysis failed: ${(error as Error).message}`
    );
  }
} 