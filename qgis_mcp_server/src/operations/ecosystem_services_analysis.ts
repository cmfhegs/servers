/**
 * Ecosystem Services Analysis Operations for MCP Server
 * 
 * This module implements ecosystem services analysis operations that communicate with the QGIS container.
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import QGISConnector from '../qgis_connector.js';

// Define parameter types
interface EcosystemServicesAnalysisParams {
  dem_path: string;
  output_path: string;
  land_cover_path?: string;
  soil_data_path?: string;
  climate_data_path?: string;
  services_to_assess?: string[];
  weights?: {
    carbon_sequestration?: number;
    water_quality?: number;
    biodiversity?: number;
    flood_regulation?: number;
    erosion_control?: number;
    recreation?: number;
    [key: string]: number;
  };
  land_cover_mapping?: Record<string, Record<string, number>>;
  include_individual_services?: boolean;
  output_format?: string;
}

interface EcosystemServicesAnalysisResponse {
  combined_services_layer_path: string;
  individual_services_layers?: {
    carbon_sequestration?: string;
    water_quality?: string;
    biodiversity?: string;
    flood_regulation?: string;
    erosion_control?: string;
    recreation?: string;
    [key: string]: string;
  };
  visualization_path: string;
  statistics: {
    mean_ecosystem_services_value: number;
    min_ecosystem_services_value: number;
    max_ecosystem_services_value: number;
    service_coverage: {
      high_value: number;
      moderate_value: number;
      low_value: number;
      minimal_value: number;
    };
    service_contributions: {
      [key: string]: number;
    };
  };
  metadata?: {
    operation_time: string;
    operation_type: string;
    input_dem: string;
    input_land_cover: string;
    input_soil: string;
    services_assessed: string[];
    output_files: string[];
    parameters: {
      weights: Record<string, number>;
      output_format: string;
    };
  };
}

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'ecosystem-services-analysis' },
  transports: [
    new winston.transports.File({ filename: 'ecosystem-services-analysis-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'ecosystem-services-analysis.log' }),
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
 * Executes ecosystem services analysis using the QGIS server
 * @param params - Ecosystem services analysis parameters
 * @returns Analysis results
 */
export async function ecosystemServicesAnalysis(params: EcosystemServicesAnalysisParams): Promise<EcosystemServicesAnalysisResponse> {
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

    // Handle optional land cover path
    let landCoverPath = null;
    if (params.land_cover_path) {
      landCoverPath = path.isAbsolute(params.land_cover_path)
        ? params.land_cover_path
        : path.join(DATA_DIR, params.land_cover_path);
      
      if (!fs.existsSync(landCoverPath)) {
        throw new McpError(
          ErrorCode.InvalidParameters,
          `Land cover file not found: ${landCoverPath}`
        );
      }
    }

    // Handle optional soil data path
    let soilDataPath = null;
    if (params.soil_data_path) {
      soilDataPath = path.isAbsolute(params.soil_data_path)
        ? params.soil_data_path
        : path.join(DATA_DIR, params.soil_data_path);
      
      if (!fs.existsSync(soilDataPath)) {
        throw new McpError(
          ErrorCode.InvalidParameters,
          `Soil data file not found: ${soilDataPath}`
        );
      }
    }

    // Handle optional climate data path
    let climateDataPath = null;
    if (params.climate_data_path) {
      climateDataPath = path.isAbsolute(params.climate_data_path)
        ? params.climate_data_path
        : path.join(DATA_DIR, params.climate_data_path);
      
      if (!fs.existsSync(climateDataPath)) {
        throw new McpError(
          ErrorCode.InvalidParameters,
          `Climate data file not found: ${climateDataPath}`
        );
      }
    }

    // Define default ecosystem services to assess if not provided
    const servicesToAssess = params.services_to_assess || [
      'carbon_sequestration',
      'water_quality',
      'biodiversity',
      'flood_regulation',
      'erosion_control'
    ];

    // Define default weights if not provided
    const weights = params.weights || {
      carbon_sequestration: 1.0,
      water_quality: 1.0,
      biodiversity: 1.0,
      flood_regulation: 1.0,
      erosion_control: 1.0
    };

    // Normalize weights to ensure they sum to 1.0
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    const normalizedWeights: Record<string, number> = {};
    
    Object.entries(weights).forEach(([service, weight]) => {
      normalizedWeights[service] = weight / totalWeight;
    });

    // Prepare request payload
    const requestData: EcosystemServicesAnalysisParams = {
      dem_path: demPath,
      output_path: outputPath,
      land_cover_path: landCoverPath,
      soil_data_path: soilDataPath,
      climate_data_path: climateDataPath,
      services_to_assess: servicesToAssess,
      weights: normalizedWeights,
      land_cover_mapping: params.land_cover_mapping,
      include_individual_services: params.include_individual_services !== undefined 
        ? params.include_individual_services 
        : true,
      output_format: params.output_format || 'geotiff'
    };

    // Execute request
    logger.info('Performing ecosystem services analysis', { params: requestData });
    
    // Call QGIS server via connector
    const response = await QGISConnector.performEcosystemServicesAnalysis(requestData);
    
    if (!response.success) {
      throw new McpError(
        ErrorCode.InternalError,
        `Ecosystem services analysis failed: ${response.error?.message || 'Unknown error'}`
      );
    }
    
    // Construct output file paths for metadata
    const baseOutputName = path.parse(outputPath).name;
    const outputFiles = [outputPath, `${baseOutputName}_visualization.png`];
    
    if (params.include_individual_services) {
      servicesToAssess.forEach(service => {
        outputFiles.push(`${baseOutputName}_${service}.tif`);
      });
    }
    
    return {
      ...(response.data as any),
      // Add metadata about the operation
      metadata: {
        operation_time: new Date().toISOString(),
        operation_type: 'ecosystem_services_analysis',
        input_dem: params.dem_path,
        input_land_cover: params.land_cover_path || 'Generated from DEM',
        input_soil: params.soil_data_path || 'Default soil data',
        services_assessed: servicesToAssess,
        output_files: outputFiles,
        parameters: {
          weights: normalizedWeights,
          output_format: params.output_format || 'geotiff'
        }
      }
    };
  } catch (error) {
    logger.error('Error in ecosystem services analysis', { 
      error: (error as Error).message, 
      stack: (error as Error).stack 
    });
    
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Ecosystem services analysis failed: ${(error as Error).message}`
    );
  }
} 