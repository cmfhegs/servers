/**
 * Zoning Analysis Operations for MCP Server
 * 
 * This module implements zoning analysis operations that communicate with the QGIS container.
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import QGISConnector from '../qgis_connector.js';

// Define parameter types
interface ZoningAnalysisParams {
  dem_path: string;
  output_path: string;
  zoning_data_path?: string;
  buffer_distance?: number;
  allowed_uses?: string[];
  zoning_classes?: ZoningClass[];
  output_format?: string;
}

interface ZoningClass {
  id: string;
  name: string;
  allowed_uses: string[];
  restrictions: string[];
  density: number;
  color: string;
}

interface ZoningAnalysisResponse {
  zoning_layer_path: string;
  visualization_path: string;
  statistics: {
    zone_distribution: Record<string, number>;
    total_area: number;
    buildable_area: number;
    restricted_area: number;
  };
  metadata?: {
    operation_time: string;
    operation_type: string;
    input_dem: string;
    zoning_data: string;
    output_files: string[];
    parameters: {
      buffer_distance: number;
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
  defaultMeta: { service: 'zoning-analysis' },
  transports: [
    new winston.transports.File({ filename: 'zoning-analysis-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'zoning-analysis.log' }),
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
 * Executes zoning analysis using the QGIS server
 * @param params - Zoning analysis parameters
 * @returns Analysis results
 */
export async function zoningAnalysis(params: ZoningAnalysisParams): Promise<ZoningAnalysisResponse> {
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

    const zoningDataPath = params.zoning_data_path 
      ? (path.isAbsolute(params.zoning_data_path) 
          ? params.zoning_data_path 
          : path.join(DATA_DIR, params.zoning_data_path))
      : null;

    // Ensure DEM file exists
    if (!fs.existsSync(demPath)) {
      throw new McpError(
        ErrorCode.InvalidParameters,
        `DEM file not found: ${demPath}`
      );
    }

    // Check if zoning data file exists if provided
    if (zoningDataPath && !fs.existsSync(zoningDataPath)) {
      throw new McpError(
        ErrorCode.InvalidParameters,
        `Zoning data file not found: ${zoningDataPath}`
      );
    }

    // Prepare request payload
    const requestData: ZoningAnalysisParams = {
      dem_path: demPath,
      output_path: outputPath,
      zoning_data_path: zoningDataPath,
      buffer_distance: params.buffer_distance || 0,
      allowed_uses: params.allowed_uses || [],
      zoning_classes: params.zoning_classes || [],
      output_format: params.output_format || 'geojson'
    };

    // Execute request
    logger.info('Performing zoning analysis', { params: requestData });
    
    // Call QGIS server via connector
    const response = await QGISConnector.performZoningAnalysis(requestData);
    
    if (!response.success) {
      throw new McpError(
        ErrorCode.InternalError,
        `Zoning analysis failed: ${response.error?.message || 'Unknown error'}`
      );
    }
    
    return {
      ...(response.data as any),
      // Add metadata about the operation
      metadata: {
        operation_time: new Date().toISOString(),
        operation_type: 'zoning_analysis',
        input_dem: params.dem_path,
        zoning_data: params.zoning_data_path || 'Not provided',
        output_files: [
          params.output_path,
          `${path.parse(params.output_path).name}_visualization.png`
        ],
        parameters: {
          buffer_distance: params.buffer_distance || 0,
          output_format: params.output_format || 'geojson'
        }
      }
    };
  } catch (error) {
    logger.error('Error in zoning analysis', { 
      error: (error as Error).message, 
      stack: (error as Error).stack 
    });
    
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Zoning analysis failed: ${(error as Error).message}`
    );
  }
} 