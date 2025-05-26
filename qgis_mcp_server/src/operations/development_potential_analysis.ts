/**
 * Development Potential Analysis Operations for MCP Server
 * 
 * This module implements development potential analysis operations that communicate with the QGIS container.
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import QGISConnector from '../qgis_connector.js';

// Define parameter types
export interface DevelopmentPotentialParams {
  dem_path: string;
  output_path: string;
  project_name: string;
  zoning_layers?: string[];
  land_use_layers?: string[];
  slope_threshold?: number;
  proximity_to_roads?: number;
  proximity_to_utilities?: number;
  environmental_constraints?: string[];
  economic_factors?: {
    land_value?: number;
    development_cost?: number;
    roi?: number;
  };
  market_demand?: {
    residential?: number;
    commercial?: number;
    industrial?: number;
    mixed?: number;
  };
  regulatory_weighting?: number;
  weightings?: {
    accessibility?: number;
    infrastructure?: number;
    environmental?: number;
    economic?: number;
    social?: number;
  };
}

export interface DevelopmentPotentialResponse {
  potential_score_layer: string;
  suitable_areas_vector: string;
  development_zones_layer: string;
  statistics: {
    high_potential_area_ha: number;
    moderate_potential_area_ha: number;
    low_potential_area_ha: number;
    unsuitable: number;
    average_potential_score: number;
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
  defaultMeta: { service: 'development-potential-analysis' },
  transports: [
    new winston.transports.File({ filename: 'development-potential-analysis-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'development-potential-analysis.log' }),
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
 * Executes development potential analysis using the QGIS server
 * @param params - Development potential analysis parameters
 * @returns Analysis results
 */
export async function developmentPotentialAnalysis(params: DevelopmentPotentialParams): Promise<DevelopmentPotentialResponse> {
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

    if (!params.project_name) {
      throw new McpError(
        ErrorCode.InvalidParameters,
        'Missing required parameter: project_name'
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

    // Process zoning layers
    const zoningLayers: string[] = [];
    if (params.zoning_layers && params.zoning_layers.length > 0) {
      for (const layer of params.zoning_layers) {
        const layerPath = path.isAbsolute(layer)
          ? layer
          : path.join(DATA_DIR, layer);
        
        if (fs.existsSync(layerPath)) {
          zoningLayers.push(layerPath);
        } else {
          logger.warn(`Zoning layer not found: ${layerPath}`);
        }
      }
    }

    // Process land use layers
    const landUseLayers: string[] = [];
    if (params.land_use_layers && params.land_use_layers.length > 0) {
      for (const layer of params.land_use_layers) {
        const layerPath = path.isAbsolute(layer)
          ? layer
          : path.join(DATA_DIR, layer);
        
        if (fs.existsSync(layerPath)) {
          landUseLayers.push(layerPath);
        } else {
          logger.warn(`Land use layer not found: ${layerPath}`);
        }
      }
    }

    // Process environmental constraint layers
    const environmentalConstraints: string[] = [];
    if (params.environmental_constraints && params.environmental_constraints.length > 0) {
      for (const layer of params.environmental_constraints) {
        const layerPath = path.isAbsolute(layer)
          ? layer
          : path.join(DATA_DIR, layer);
        
        if (fs.existsSync(layerPath)) {
          environmentalConstraints.push(layerPath);
        } else {
          logger.warn(`Environmental constraint layer not found: ${layerPath}`);
        }
      }
    }

    // Validate numeric parameters
    const slopeThreshold = params.slope_threshold !== undefined 
      ? params.slope_threshold 
      : 15;
    
    if (slopeThreshold < 0 || slopeThreshold > 90) {
      throw new McpError(
        ErrorCode.InvalidParameters,
        'Slope threshold must be between 0 and 90 degrees'
      );
    }

    const proximityToRoads = params.proximity_to_roads !== undefined 
      ? params.proximity_to_roads 
      : 1000;
    
    if (proximityToRoads < 0) {
      throw new McpError(
        ErrorCode.InvalidParameters,
        'Proximity to roads must be a positive value'
      );
    }

    const proximityToUtilities = params.proximity_to_utilities !== undefined 
      ? params.proximity_to_utilities 
      : 500;
    
    if (proximityToUtilities < 0) {
      throw new McpError(
        ErrorCode.InvalidParameters,
        'Proximity to utilities must be a positive value'
      );
    }

    // Validate weightings (must sum to 1.0)
    const weightings = params.weightings || {
      accessibility: 0.20,
      infrastructure: 0.25,
      environmental: 0.20,
      economic: 0.25,
      social: 0.10
    };
    
    const weightingSum = Object.values(weightings).reduce((sum, weight) => sum + weight, 0);
    
    if (Math.abs(weightingSum - 1.0) > 0.01) {
      // Normalize weightings to sum to 1.0
      Object.keys(weightings).forEach(key => {
        weightings[key as keyof typeof weightings] = 
          weightings[key as keyof typeof weightings] / weightingSum;
      });
    }

    // Validate regulatory weighting (must be between 0 and 1)
    const regulatoryWeighting = params.regulatory_weighting !== undefined 
      ? params.regulatory_weighting 
      : 0.8;
    
    if (regulatoryWeighting < 0 || regulatoryWeighting > 1) {
      throw new McpError(
        ErrorCode.InvalidParameters,
        'Regulatory weighting must be between 0 and 1'
      );
    }

    // Prepare request payload
    const requestData: DevelopmentPotentialParams = {
      dem_path: demPath,
      output_path: outputPath,
      project_name: params.project_name,
      zoning_layers: zoningLayers,
      land_use_layers: landUseLayers,
      slope_threshold: slopeThreshold,
      proximity_to_roads: proximityToRoads,
      proximity_to_utilities: proximityToUtilities,
      environmental_constraints: environmentalConstraints,
      economic_factors: params.economic_factors || {},
      market_demand: params.market_demand || {},
      regulatory_weighting: regulatoryWeighting,
      weightings: weightings
    };

    // Execute request
    logger.info('Performing development potential analysis', { params: requestData });
    
    // Call QGIS server via connector
    const response = await QGISConnector.performDevelopmentPotentialAnalysis(requestData);
    
    if (!response.success) {
      throw new McpError(
        ErrorCode.InternalError,
        `Development potential analysis failed: ${response.error?.message || 'Unknown error'}`
      );
    }
    
    return {
      ...(response.data as any),
      // Additional processing can be done here if needed
    };
  } catch (error) {
    logger.error('Error in development potential analysis', { 
      error: (error as Error).message, 
      stack: (error as Error).stack 
    });
    
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Development potential analysis failed: ${(error as Error).message}`
    );
  }
} 