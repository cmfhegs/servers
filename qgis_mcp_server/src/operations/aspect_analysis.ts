/**
 * Aspect Analysis Operations for MCP Server
 * 
 * This module implements aspect analysis operations that communicate with the QGIS container.
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import QGISConnector from '../qgis_connector.js';

// Define parameter types
interface AspectAnalysisParams {
  dem_path: string;
  output_path: string;
  categories?: number;
  output_format?: string;
  include_flat?: boolean;
  category_labels?: string[] | null;
}

interface AspectAnalysisResponse {
  aspect_raster_path: string;
  visualization_path: string;
  statistics: {
    predominant_direction: string;
    direction_counts: Record<string, number>;
    total_pixels: number;
  };
  metadata?: {
    operation_time: string;
    operation_type: string;
    input_dem: string;
    output_files: string[];
    parameters: {
      categories: number;
      output_format: string;
      include_flat: boolean;
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
  defaultMeta: { service: 'aspect-analysis' },
  transports: [
    new winston.transports.File({ filename: 'aspect-analysis-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'aspect-analysis.log' }),
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
 * Executes aspect analysis on a DEM using the QGIS server
 * @param params - Aspect analysis parameters
 * @returns Analysis results
 */
export async function aspectAnalysis(params: AspectAnalysisParams): Promise<AspectAnalysisResponse> {
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
    const requestData: AspectAnalysisParams = {
      dem_path: demPath,
      output_path: outputPath,
      categories: params.categories || 8,
      output_format: params.output_format || 'geotiff',
      include_flat: params.include_flat !== false,
      category_labels: params.category_labels || null
    };

    // Execute request
    logger.info('Performing aspect analysis', { params: requestData });
    
    // Call QGIS server via connector
    const response = await QGISConnector.performAspectAnalysis(requestData);
    
    if (!response.success) {
      throw new McpError(
        ErrorCode.InternalError,
        `Aspect analysis failed: ${response.error?.message || 'Unknown error'}`
      );
    }
    
    return {
      ...(response.data as any),
      // Add metadata about the operation
      metadata: {
        operation_time: new Date().toISOString(),
        operation_type: 'aspect_analysis',
        input_dem: params.dem_path,
        output_files: [
          params.output_path,
          `${path.parse(params.output_path).name}_visualization.png`
        ],
        parameters: {
          categories: params.categories || 8,
          output_format: params.output_format || 'geotiff',
          include_flat: params.include_flat !== false
        }
      }
    };
  } catch (error) {
    logger.error('Error in aspect analysis', { 
      error: (error as Error).message, 
      stack: (error as Error).stack 
    });
    
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Aspect analysis failed: ${(error as Error).message}`
    );
  }
} 