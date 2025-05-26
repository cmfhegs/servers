/**
 * Slope Analysis Operations for MCP Server
 * 
 * This module implements slope analysis operations that communicate with the QGIS container.
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import QGISConnector from '../qgis_connector.js';

// Define parameter types
interface SlopeAnalysisParams {
  dem_path: string;
  output_path: string;
  slope_units?: 'degrees' | 'percent';
  z_factor?: number;
  output_format?: string;
  min_slope?: number;
  max_slope?: number;
  classification?: string;
}

interface SlopeAnalysisResponse {
  slope_raster_path: string;
  visualization_path: string;
  statistics: {
    min_slope: number;
    max_slope: number;
    mean_slope: number;
    std_dev: number;
    slope_distribution: Record<string, number>;
  };
  metadata?: {
    operation_time: string;
    operation_type: string;
    input_dem: string;
    output_files: string[];
    parameters: {
      slope_units: string;
      z_factor: number;
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
  defaultMeta: { service: 'slope-analysis' },
  transports: [
    new winston.transports.File({ filename: 'slope-analysis-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'slope-analysis.log' }),
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
 * Executes slope analysis on a DEM using the QGIS server
 * @param params - Slope analysis parameters
 * @returns Analysis results
 */
export async function slopeAnalysis(params: SlopeAnalysisParams): Promise<SlopeAnalysisResponse> {
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

    // Validate slope units
    const allowedSlopeUnits = ['degrees', 'percent'];
    if (params.slope_units && !allowedSlopeUnits.includes(params.slope_units)) {
      throw new McpError(
        ErrorCode.InvalidParameters,
        `Invalid slope units: ${params.slope_units}. Must be one of: ${allowedSlopeUnits.join(', ')}`
      );
    }

    // Prepare request payload
    const requestData: SlopeAnalysisParams = {
      dem_path: demPath,
      output_path: outputPath,
      slope_units: params.slope_units || 'percent',
      z_factor: params.z_factor || 1.0,
      output_format: params.output_format || 'geotiff',
      min_slope: params.min_slope,
      max_slope: params.max_slope,
      classification: params.classification || 'default'
    };

    // Execute request
    logger.info('Performing slope analysis', { params: requestData });
    
    // Call QGIS server via connector
    const response = await QGISConnector.performSlopeAnalysis(requestData);
    
    if (!response.success) {
      throw new McpError(
        ErrorCode.InternalError,
        `Slope analysis failed: ${response.error?.message || 'Unknown error'}`
      );
    }
    
    return {
      ...(response.data as any),
      // Add metadata about the operation
      metadata: {
        operation_time: new Date().toISOString(),
        operation_type: 'slope_analysis',
        input_dem: params.dem_path,
        output_files: [
          params.output_path,
          `${path.parse(params.output_path).name}_visualization.png`
        ],
        parameters: {
          slope_units: params.slope_units || 'percent',
          z_factor: params.z_factor || 1.0,
          output_format: params.output_format || 'geotiff'
        }
      }
    };
  } catch (error) {
    logger.error('Error in slope analysis', { 
      error: (error as Error).message, 
      stack: (error as Error).stack 
    });
    
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Slope analysis failed: ${(error as Error).message}`
    );
  }
} 