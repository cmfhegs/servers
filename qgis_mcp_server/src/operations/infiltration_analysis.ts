/**
 * Infiltration Analysis Operations for MCP Server
 * 
 * This module implements infiltration analysis operations that communicate with the QGIS container.
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import QGISConnector from '../qgis_connector.js';

// Define parameter types
interface InfiltrationAnalysisParams {
  dem_path: string;
  output_path: string;
  soil_data_path?: string;
  land_cover_path?: string;
  precipitation_amount?: number;
  precipitation_duration?: number;
  soil_moisture_initial?: number;
  infiltration_method?: string;
  include_excess_rainfall?: boolean;
  output_format?: string;
}

interface InfiltrationAnalysisResponse {
  infiltration_layer_path: string;
  excess_rainfall_path?: string;
  visualization_path: string;
  statistics: {
    mean_infiltration_rate: number;
    min_infiltration_rate: number;
    max_infiltration_rate: number;
    total_infiltration_volume: number;
    area_distribution: {
      high_infiltration: number;
      moderate_infiltration: number;
      low_infiltration: number;
      very_low_infiltration: number;
    };
  };
  metadata?: {
    operation_time: string;
    operation_type: string;
    input_dem: string;
    input_soil: string;
    input_land_cover: string;
    output_files: string[];
    parameters: {
      precipitation_amount: number;
      precipitation_duration: number;
      soil_moisture_initial: number;
      infiltration_method: string;
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
  defaultMeta: { service: 'infiltration-analysis' },
  transports: [
    new winston.transports.File({ filename: 'infiltration-analysis-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'infiltration-analysis.log' }),
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
 * Executes infiltration analysis using the QGIS server
 * @param params - Infiltration analysis parameters
 * @returns Analysis results
 */
export async function infiltrationAnalysis(params: InfiltrationAnalysisParams): Promise<InfiltrationAnalysisResponse> {
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

    // Prepare request payload
    const requestData: InfiltrationAnalysisParams = {
      dem_path: demPath,
      output_path: outputPath,
      soil_data_path: soilDataPath,
      land_cover_path: landCoverPath,
      precipitation_amount: params.precipitation_amount || 25, // 25mm by default
      precipitation_duration: params.precipitation_duration || 1, // 1 hour by default
      soil_moisture_initial: params.soil_moisture_initial || 0.4, // 40% by default
      infiltration_method: params.infiltration_method || 'green_ampt',
      include_excess_rainfall: params.include_excess_rainfall !== undefined 
        ? params.include_excess_rainfall 
        : true,
      output_format: params.output_format || 'geotiff'
    };

    // Execute request
    logger.info('Performing infiltration analysis', { params: requestData });
    
    // Call QGIS server via connector
    const response = await QGISConnector.performInfiltrationAnalysis(requestData);
    
    if (!response.success) {
      throw new McpError(
        ErrorCode.InternalError,
        `Infiltration analysis failed: ${response.error?.message || 'Unknown error'}`
      );
    }
    
    // Construct output file paths for metadata
    const baseOutputName = path.parse(outputPath).name;
    const outputFiles = [outputPath, `${baseOutputName}_visualization.png`];
    
    if (params.include_excess_rainfall) {
      outputFiles.push(`${baseOutputName}_excess_rainfall.tif`);
    }
    
    return {
      ...(response.data as any),
      // Add metadata about the operation
      metadata: {
        operation_time: new Date().toISOString(),
        operation_type: 'infiltration_analysis',
        input_dem: params.dem_path,
        input_soil: params.soil_data_path || 'Generated from DEM',
        input_land_cover: params.land_cover_path || 'Default classification',
        output_files: outputFiles,
        parameters: {
          precipitation_amount: params.precipitation_amount || 25,
          precipitation_duration: params.precipitation_duration || 1,
          soil_moisture_initial: params.soil_moisture_initial || 0.4,
          infiltration_method: params.infiltration_method || 'green_ampt',
          output_format: params.output_format || 'geotiff'
        }
      }
    };
  } catch (error) {
    logger.error('Error in infiltration analysis', { 
      error: (error as Error).message, 
      stack: (error as Error).stack 
    });
    
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Infiltration analysis failed: ${(error as Error).message}`
    );
  }
} 