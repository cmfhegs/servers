/**
 * Terrain Classification Analysis Operations for MCP Server
 * 
 * This module implements terrain classification analysis operations that communicate with the QGIS container.
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import QGISConnector from '../qgis_connector.js';

// Define parameter types
interface TerrainClassificationAnalysisParams {
  dem_path: string;
  output_path: string;
  classification_method?: string;
  num_classes?: number;
  custom_breaks?: number[];
  custom_classes?: TerrainClass[];
  use_geomorphons?: boolean;
  output_format?: string;
}

interface TerrainClass {
  id: string;
  name: string;
  min_elevation?: number;
  max_elevation?: number;
  min_slope?: number;
  max_slope?: number;
  color: string;
  description?: string;
}

interface TerrainClassificationAnalysisResponse {
  terrain_layer_path: string;
  visualization_path: string;
  statistics: {
    class_distribution: Record<string, number>;
    elevation_stats: {
      min: number;
      max: number;
      mean: number;
      std_dev: number;
    };
    slope_stats: {
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
      classification_method: string;
      num_classes: number;
      use_geomorphons: boolean;
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
  defaultMeta: { service: 'terrain-classification-analysis' },
  transports: [
    new winston.transports.File({ filename: 'terrain-classification-analysis-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'terrain-classification-analysis.log' }),
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
 * Executes terrain classification analysis using the QGIS server
 * @param params - Terrain classification analysis parameters
 * @returns Analysis results
 */
export async function terrainClassificationAnalysis(params: TerrainClassificationAnalysisParams): Promise<TerrainClassificationAnalysisResponse> {
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
    const requestData: TerrainClassificationAnalysisParams = {
      dem_path: demPath,
      output_path: outputPath,
      classification_method: params.classification_method || 'natural_breaks',
      num_classes: params.num_classes || 6,
      custom_breaks: params.custom_breaks || [],
      custom_classes: params.custom_classes || [],
      use_geomorphons: params.use_geomorphons || false,
      output_format: params.output_format || 'geotiff'
    };

    // Execute request
    logger.info('Performing terrain classification analysis', { params: requestData });
    
    // Call QGIS server via connector
    const response = await QGISConnector.performTerrainClassificationAnalysis(requestData);
    
    if (!response.success) {
      throw new McpError(
        ErrorCode.InternalError,
        `Terrain classification analysis failed: ${response.error?.message || 'Unknown error'}`
      );
    }
    
    return {
      ...(response.data as any),
      // Add metadata about the operation
      metadata: {
        operation_time: new Date().toISOString(),
        operation_type: 'terrain_classification_analysis',
        input_dem: params.dem_path,
        output_files: [
          params.output_path,
          `${path.parse(params.output_path).name}_visualization.png`
        ],
        parameters: {
          classification_method: params.classification_method || 'natural_breaks',
          num_classes: params.num_classes || 6,
          use_geomorphons: params.use_geomorphons || false,
          output_format: params.output_format || 'geotiff'
        }
      }
    };
  } catch (error) {
    logger.error('Error in terrain classification analysis', { 
      error: (error as Error).message, 
      stack: (error as Error).stack 
    });
    
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Terrain classification analysis failed: ${(error as Error).message}`
    );
  }
} 