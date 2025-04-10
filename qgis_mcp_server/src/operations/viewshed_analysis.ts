/**
 * Viewshed Analysis Operations for MCP Server
 * 
 * This module implements viewshed analysis operations that communicate with the QGIS container.
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import QGISConnector from '../qgis_connector.js';

// Type definitions
interface ObserverPoint {
  x: number;
  y: number;
  height?: number;
}

interface ViewshedAnalysisParameters {
  dem_path: string;
  output_path: string;
  observer_points: ObserverPoint[];
  observer_height?: number;
  radius?: number;
  output_format?: string;
}

interface ViewshedStatistics {
  visibleAreaKm2: number;
  percentageVisible: number;
  maxDistance: number;
  totalArea?: number;
}

interface ViewshedAnalysisResponse {
  viewshed_raster_path: string;
  visualization_path: string;
  geojson_path?: string;
  statistics: ViewshedStatistics;
  metadata?: {
    operation_time: string;
    operation_type: string;
    input_dem: string;
    output_files: string[];
    parameters: {
      observer_points: ObserverPoint[];
      observer_height: number;
      radius: number;
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
  defaultMeta: { service: 'viewshed-analysis' },
  transports: [
    new winston.transports.File({ filename: 'viewshed-analysis-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'viewshed-analysis.log' }),
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
 * Executes viewshed analysis on a DEM using the QGIS server
 * @param params - Viewshed analysis parameters
 * @returns Analysis results
 */
export async function viewshedAnalysis(params: ViewshedAnalysisParameters): Promise<ViewshedAnalysisResponse> {
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

    if (!params.observer_points || !Array.isArray(params.observer_points) || params.observer_points.length === 0) {
      throw new McpError(
        ErrorCode.InvalidParameters,
        'Missing or invalid observer_points. Must provide at least one observer point with x and y coordinates.'
      );
    }

    // Validate observer points
    params.observer_points.forEach((point, index) => {
      if (typeof point.x !== 'number' || typeof point.y !== 'number') {
        throw new McpError(
          ErrorCode.InvalidParameters,
          `Invalid observer point at index ${index}: Must have numeric x and y coordinates.`
        );
      }
    });

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
    const requestData: ViewshedAnalysisParameters = {
      dem_path: demPath,
      output_path: outputPath,
      observer_points: params.observer_points,
      observer_height: params.observer_height || 1.8, // Default observer height (human eye level)
      radius: params.radius || 5000, // Default 5km radius
      output_format: params.output_format || 'geotiff'
    };

    // Execute request
    logger.info('Performing viewshed analysis', { params: requestData });
    
    // Call QGIS server via connector
    const response = await QGISConnector.performViewshedAnalysis(requestData);
    
    if (!response.success) {
      throw new McpError(
        ErrorCode.InternalError,
        `Viewshed analysis failed: ${response.error?.message || 'Unknown error'}`
      );
    }
    
    return {
      ...(response.data as any),
      // Add metadata about the operation
      metadata: {
        operation_time: new Date().toISOString(),
        operation_type: 'viewshed_analysis',
        input_dem: params.dem_path,
        output_files: [
          params.output_path,
          `${path.parse(params.output_path).name}_visualization.png`,
          `${path.parse(params.output_path).name}_geojson.json`
        ],
        parameters: {
          observer_points: params.observer_points,
          observer_height: params.observer_height || 1.8,
          radius: params.radius || 5000,
          output_format: params.output_format || 'geotiff'
        }
      }
    };
  } catch (error) {
    logger.error('Error in viewshed analysis', { 
      error: (error as Error).message, 
      stack: (error as Error).stack 
    });
    
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Viewshed analysis failed: ${(error as Error).message}`
    );
  }
} 