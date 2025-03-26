/**
 * Terrain Analysis Operations for MCP Server
 * 
 * This module implements terrain analysis operations that communicate with the QGIS container.
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import QGISConnector from '../qgis_connector.js';

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'terrain-analysis' },
  transports: [
    new winston.transports.File({ filename: 'terrain-analysis-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'terrain-analysis.log' }),
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
    logger.error('Failed to create output directory', { error: error.message });
  }
}

/**
 * Executes slope analysis on a DEM using the QGIS server
 * @param {Object} params - Slope analysis parameters
 * @returns {Promise<Object>} Analysis results
 */
export async function slopeAnalysis(params) {
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
    const requestData = {
      dem_path: demPath,
      output_path: outputPath,
      slope_units: params.slope_units || 'percent',
      output_format: params.output_format || 'geotiff',
      class_ranges: params.class_ranges || [2, 5, 10, 15, 25],
      class_labels: params.class_labels || [],
      stormwater_suitability: params.stormwater_suitability !== false
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
      ...response.data,
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
          class_ranges: params.class_ranges || [2, 5, 10, 15, 25],
          stormwater_suitability: params.stormwater_suitability !== false
        }
      }
    };
  } catch (error) {
    logger.error('Error in slope analysis', { error: error.message, stack: error.stack });
    
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Slope analysis failed: ${error.message}`
    );
  }
}

/**
 * Checks if the QGIS server is available
 * @returns {Promise<boolean>} True if the server is available
 */
export async function checkQgisServerHealth() {
  try {
    return await QGISConnector.checkHealth();
  } catch (error) {
    logger.error('Failed to check QGIS server health', { error: error.message });
    return false;
  }
}

/**
 * Lists available QGIS algorithms
 * @returns {Promise<Array>} List of available algorithms
 */
export async function listAvailableAlgorithms() {
  try {
    return await QGISConnector.getAlgorithms();
  } catch (error) {
    logger.error('Failed to list QGIS algorithms', { error: error.message });
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to list QGIS algorithms: ${error.message}`
    );
  }
}
