/**
 * Watershed Analysis Operations for MCP Server
 * 
 * This module implements watershed analysis operations that communicate with the QGIS container.
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import QGISConnector from '../qgis_connector.js';

// Type definitions
interface PourPoint {
  x: number;
  y: number;
  id?: string;
}

interface WatershedAnalysisParameters {
  dem_path: string;
  output_path: string;
  pour_points: PourPoint[] | [number, number][];
  snap_distance?: number;
  min_basin_size?: number;
  output_format?: string;
}

interface WatershedStatistics {
  watershed_count: number;
  total_area_km2: number;
  average_area_km2: number;
  min_area_km2: number;
  max_area_km2: number;
  watershed_sizes?: Record<string, number>;
}

interface WatershedAnalysisResponse {
  watershed_raster_path: string;
  visualization_path: string;
  geojson_path?: string;
  stream_network_path?: string;
  statistics: WatershedStatistics;
  metadata?: {
    operation_time: string;
    operation_type: string;
    input_dem: string;
    output_files: string[];
    parameters: {
      pour_points: Array<[number, number]>;
      snap_distance: number;
      min_basin_size: number;
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
  defaultMeta: { service: 'watershed-analysis' },
  transports: [
    new winston.transports.File({ filename: 'watershed-analysis-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'watershed-analysis.log' }),
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
 * Normalize pour points to standardized format
 * @param pourPoints Input pour points, can be array of objects or array of coordinate pairs
 * @returns Normalized array of [x, y] coordinate pairs
 */
function normalizePourPoints(pourPoints: PourPoint[] | [number, number][]): Array<[number, number]> {
  return pourPoints.map(point => {
    if (Array.isArray(point)) {
      return [point[0], point[1]];
    }
    return [point.x, point.y];
  });
}

/**
 * Executes watershed analysis on a DEM using the QGIS server
 * @param params - Watershed analysis parameters
 * @returns Analysis results
 */
export async function watershedAnalysis(params: WatershedAnalysisParameters): Promise<WatershedAnalysisResponse> {
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

    if (!params.pour_points || !Array.isArray(params.pour_points) || params.pour_points.length === 0) {
      throw new McpError(
        ErrorCode.InvalidParameters,
        'Missing or invalid pour_points. Must provide at least one pour point.'
      );
    }

    // Normalize pour points to coordinate array format
    const normalizedPourPoints = normalizePourPoints(params.pour_points);

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
    const requestData = {
      dem_path: demPath,
      output_path: outputPath,
      pour_points: normalizedPourPoints,
      snap_distance: params.snap_distance || 100, // Default 100m snap distance
      min_basin_size: params.min_basin_size || 1000, // Default 1000 cell minimum basin size
      output_format: params.output_format || 'geotiff'
    };

    // Execute request
    logger.info('Performing watershed analysis', { params: requestData });
    
    // Call QGIS server via connector
    const response = await QGISConnector.performWatershedAnalysis(requestData);
    
    if (!response.success) {
      throw new McpError(
        ErrorCode.InternalError,
        `Watershed analysis failed: ${response.error?.message || 'Unknown error'}`
      );
    }
    
    return {
      ...(response.data as any),
      // Add metadata about the operation
      metadata: {
        operation_time: new Date().toISOString(),
        operation_type: 'watershed_analysis',
        input_dem: params.dem_path,
        output_files: [
          params.output_path,
          `${path.parse(params.output_path).name}_visualization.png`,
          `${path.parse(params.output_path).name}_geojson.json`,
          `${path.parse(params.output_path).name}_stream_network.geojson`
        ],
        parameters: {
          pour_points: normalizedPourPoints,
          snap_distance: params.snap_distance || 100,
          min_basin_size: params.min_basin_size || 1000,
          output_format: params.output_format || 'geotiff'
        }
      }
    };
  } catch (error) {
    logger.error('Error in watershed analysis', { 
      error: (error as Error).message, 
      stack: (error as Error).stack 
    });
    
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Watershed analysis failed: ${(error as Error).message}`
    );
  }
} 