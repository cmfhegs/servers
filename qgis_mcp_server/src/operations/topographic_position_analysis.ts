/**
 * Topographic Position Analysis Operations for MCP Server
 * 
 * This module implements topographic position analysis operations that communicate with the QGIS container.
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import QGISConnector from '../qgis_connector.js';

// Define parameter types
interface TopographicPositionAnalysisParams {
  dem_path: string;
  output_path: string;
  neighborhood_size?: number;
  neighborhood_type?: string;
  classification_method?: string;
  num_classes?: number;
  custom_breaks?: number[];
  output_format?: string;
}

interface TopographicPositionAnalysisResponse {
  tpi_layer_path: string;
  visualization_path: string;
  statistics: {
    landform_distribution: Record<string, number>;
    elevation_stats: {
      min: number;
      max: number;
      mean: number;
      std_dev: number;
    };
    tpi_stats: {
      min: number;
      max: number;
      mean: number;
      std_dev: number;
    };
  };
  metadata?: {
    operation_time: string;
    operation_type: string;
    input_dem: string;
    output_files: string[];
    parameters: {
      neighborhood_size: number;
      neighborhood_type: string;
      classification_method: string;
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
  defaultMeta: { service: 'topographic-position-analysis' },
  transports: [
    new winston.transports.File({ filename: 'topographic-position-analysis-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'topographic-position-analysis.log' }),
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
 * Executes topographic position analysis using the QGIS server
 * @param params - Topographic position analysis parameters
 * @returns Analysis results
 */
export async function topographicPositionAnalysis(params: TopographicPositionAnalysisParams): Promise<TopographicPositionAnalysisResponse> {
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

    // Prepare request payload
    const requestData: TopographicPositionAnalysisParams = {
      dem_path: demPath,
      output_path: outputPath,
      neighborhood_size: params.neighborhood_size || 300,
      neighborhood_type: params.neighborhood_type || 'circle',
      classification_method: params.classification_method || 'jenks',
      num_classes: params.num_classes || 6,
      custom_breaks: params.custom_breaks || [],
      output_format: params.output_format || 'geotiff'
    };

    // Execute request
    logger.info('Performing topographic position analysis', { params: requestData });
    
    // Call QGIS server via connector
    const response = await QGISConnector.performTopographicPositionAnalysis(requestData);
    
    if (!response.success) {
      throw new McpError(
        ErrorCode.InternalError,
        `Topographic position analysis failed: ${response.error?.message || 'Unknown error'}`
      );
    }
    
    return {
      ...(response.data as any),
      // Add metadata about the operation
      metadata: {
        operation_time: new Date().toISOString(),
        operation_type: 'topographic_position_analysis',
        input_dem: params.dem_path,
        output_files: [
          params.output_path,
          `${path.parse(params.output_path).name}_visualization.png`
        ],
        parameters: {
          neighborhood_size: params.neighborhood_size || 300,
          neighborhood_type: params.neighborhood_type || 'circle',
          classification_method: params.classification_method || 'jenks',
          output_format: params.output_format || 'geotiff'
        }
      }
    };
  } catch (error) {
    logger.error('Error in topographic position analysis', { 
      error: (error as Error).message, 
      stack: (error as Error).stack 
    });
    
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Topographic position analysis failed: ${(error as Error).message}`
    );
  }
} 