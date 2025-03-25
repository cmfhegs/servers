/**
 * QGIS Service Connector for MCP Server
 * 
 * This module provides the communication layer between the MCP server and the QGIS container.
 * It handles making HTTP requests to the QGIS server and processes the responses.
 */

import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'qgis-connector' },
  transports: [
    new winston.transports.File({ filename: 'qgis-connector-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'qgis-connector.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// QGIS server configuration
const QGIS_SERVER_URL = process.env.QGIS_SERVER_URL || 'http://localhost:5000';
const DATA_DIR = process.env.QGIS_DATA_DIR || path.join(process.cwd(), 'data');
const OUTPUT_DIR = process.env.QGIS_OUTPUT_DIR || path.join(process.cwd(), 'output');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Check if the QGIS server is available
 * @returns {Promise<boolean>} True if the server is available, false otherwise
 */
export async function checkQgisServerHealth() {
  try {
    const response = await axios.get(`${QGIS_SERVER_URL}/health`);
    return response.data?.status === 'ok';
  } catch (error) {
    logger.error('Failed to check QGIS server health', { error: error.message });
    return false;
  }
}

/**
 * List available QGIS algorithms
 * @returns {Promise<Array<Object>>} List of available algorithms
 */
export async function listAvailableAlgorithms() {
  try {
    const response = await axios.get(`${QGIS_SERVER_URL}/algorithms`);
    return response.data?.algorithms || [];
  } catch (error) {
    logger.error('Failed to list QGIS algorithms', { error: error.message });
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to list QGIS algorithms: ${error.message}`
    );
  }
}

/**
 * Perform slope analysis on a DEM
 * 
 * @param {Object} params Slope analysis parameters
 * @param {string} params.dem_path Path to the DEM file (relative to data directory)
 * @param {string} params.output_name Name for the output files (without extension)
 * @param {string} [params.slope_units='percent'] Units for slope measurement ('degrees' or 'percent')
 * @param {number} [params.z_factor=1.0] Z factor for slope calculation
 * @param {Array<number>} [params.class_ranges=[2,5,10,15,25]] Slope classification break points
 * @param {Array<string>} [params.class_labels] Labels for slope classes
 * @param {boolean} [params.stormwater_suitability=true] Include stormwater management suitability analysis
 * @returns {Promise<Object>} Results of the slope analysis
 */
export async function performSlopeAnalysis(params) {
  try {
    // Validate input parameters
    if (!params.dem_path) {
      throw new McpError(
        ErrorCode.InvalidParameters,
        'Missing required parameter: dem_path'
      );
    }

    if (!params.output_name) {
      throw new McpError(
        ErrorCode.InvalidParameters,
        'Missing required parameter: output_name'
      );
    }

    // Prepare full paths
    const demPath = path.join(DATA_DIR, params.dem_path);
    const outputPath = path.join(OUTPUT_DIR, `${params.output_name}_slope.tif`);

    // Ensure the DEM file exists
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
      z_factor: params.z_factor || 1.0,
      class_ranges: params.class_ranges || [2, 5, 10, 15, 25],
      class_labels: params.class_labels || [],
      stormwater_suitability: params.stormwater_suitability !== false
    };

    // Call QGIS server
    logger.info('Performing slope analysis', { params: requestData });
    const response = await axios.post(
      `${QGIS_SERVER_URL}/process/slope_analysis`,
      requestData
    );

    // Handle response
    if (!response.data.success) {
      throw new McpError(
        ErrorCode.InternalError,
        `Slope analysis failed: ${response.data.error?.message || 'Unknown error'}`
      );
    }

    return response.data.data;
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }

    logger.error('Error in slope analysis', { error: error.message, stack: error.stack });
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to perform slope analysis: ${error.message}`
    );
  }
}

/**
 * Perform flow path analysis on a DEM
 * 
 * @param {Object} params Flow path analysis parameters
 * @param {string} params.dem_path Path to the DEM file (relative to data directory)
 * @param {string} params.output_name Name for the output files (without extension)
 * @param {string} [params.algorithm='d-infinity'] Flow routing algorithm ('d8', 'd-infinity', 'mfd')
 * @param {number} [params.accumulation_threshold=1000] Minimum flow accumulation value to define a stream
 * @param {boolean} [params.fill_sinks=true] Boolean to fill sinks in the DEM before processing
 * @returns {Promise<Object>} Results of the flow path analysis
 */
export async function performFlowPathAnalysis(params) {
  try {
    // Validate input parameters
    if (!params.dem_path) {
      throw new McpError(
        ErrorCode.InvalidParameters,
        'Missing required parameter: dem_path'
      );
    }

    if (!params.output_name) {
      throw new McpError(
        ErrorCode.InvalidParameters,
        'Missing required parameter: output_name'
      );
    }

    // Prepare full paths
    const demPath = path.join(DATA_DIR, params.dem_path);
    const outputPath = path.join(OUTPUT_DIR, `${params.output_name}_flow.gpkg`);

    // Ensure the DEM file exists
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
      algorithm: params.algorithm || 'd-infinity',
      accumulation_threshold: params.accumulation_threshold || 1000,
      fill_sinks: params.fill_sinks !== false
    };

    // Call QGIS server
    logger.info('Performing flow path analysis', { params: requestData });
    const response = await axios.post(
      `${QGIS_SERVER_URL}/process/flow_path_analysis`,
      requestData
    );

    // Handle response
    if (!response.data.success) {
      throw new McpError(
        ErrorCode.InternalError,
        `Flow path analysis failed: ${response.data.error?.message || 'Unknown error'}`
      );
    }

    return response.data.data;
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }

    logger.error('Error in flow path analysis', { error: error.message, stack: error.stack });
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to perform flow path analysis: ${error.message}`
    );
  }
}

/**
 * Run a generic QGIS algorithm
 * 
 * @param {string} algorithm QGIS algorithm identifier (e.g., 'native:buffer')
 * @param {Object} parameters Algorithm parameters
 * @returns {Promise<Object>} Results of the algorithm execution
 */
export async function runQgisAlgorithm(algorithm, parameters) {
  try {
    // Validate input parameters
    if (!algorithm) {
      throw new McpError(
        ErrorCode.InvalidParameters,
        'Missing required parameter: algorithm'
      );
    }

    // Call QGIS server
    logger.info('Running QGIS algorithm', { algorithm, parameters });
    const response = await axios.post(
      `${QGIS_SERVER_URL}/process/run_algorithm`,
      {
        algorithm,
        parameters
      }
    );

    // Handle response
    if (response.data.error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Algorithm execution failed: ${response.data.error}`
      );
    }

    return response.data.results || {};
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }

    logger.error('Error running QGIS algorithm', { error: error.message, stack: error.stack });
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to run QGIS algorithm: ${error.message}`
    );
  }
}

export default {
  checkQgisServerHealth,
  listAvailableAlgorithms,
  performSlopeAnalysis,
  performFlowPathAnalysis,
  runQgisAlgorithm
};