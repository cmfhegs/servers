/**
 * Water Flow Analysis Operations for MCP Server
 * 
 * This module implements water flow analysis operations that communicate with the QGIS container.
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import QGISConnector from '../qgis_connector.js';

// Define parameter types
interface WaterFlowAnalysisParams {
  dem_path: string;
  output_path: string;
  flow_method?: string;
  stream_threshold?: number;
  include_flow_accumulation?: boolean;
  include_flow_direction?: boolean;
  include_stream_network?: boolean;
  depression_filling?: boolean;
  output_format?: string;
}

interface WaterFlowAnalysisResponse {
  flow_layer_path: string;
  stream_layer_path?: string;
  flow_accumulation_path?: string;
  flow_direction_path?: string;
  visualization_path: string;
  statistics: {
    stream_length_total: number;
    stream_segments: number;
    max_flow_accumulation: number;
    drainage_density: number;
    main_flow_directions: Record<string, number>;
  };
  metadata?: {
    operation_time: string;
    operation_type: string;
    input_dem: string;
    output_files: string[];
    parameters: {
      flow_method: string;
      stream_threshold: number;
      depression_filling: boolean;
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
  defaultMeta: { service: 'water-flow-analysis' },
  transports: [
    new winston.transports.File({ filename: 'water-flow-analysis-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'water-flow-analysis.log' }),
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
 * Executes water flow analysis using the QGIS server
 * @param params - Water flow analysis parameters
 * @returns Analysis results
 */
export async function waterFlowAnalysis(params: WaterFlowAnalysisParams): Promise<WaterFlowAnalysisResponse> {
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
    const requestData: WaterFlowAnalysisParams = {
      dem_path: demPath,
      output_path: outputPath,
      flow_method: params.flow_method || 'd8',
      stream_threshold: params.stream_threshold || 100,
      include_flow_accumulation: params.include_flow_accumulation || true,
      include_flow_direction: params.include_flow_direction || true,
      include_stream_network: params.include_stream_network || true,
      depression_filling: params.depression_filling !== undefined ? params.depression_filling : true,
      output_format: params.output_format || 'geotiff'
    };

    // Execute request
    logger.info('Performing water flow analysis', { params: requestData });
    
    // Call QGIS server via connector
    const response = await QGISConnector.performWaterFlowAnalysis(requestData);
    
    if (!response.success) {
      throw new McpError(
        ErrorCode.InternalError,
        `Water flow analysis failed: ${response.error?.message || 'Unknown error'}`
      );
    }
    
    return {
      ...(response.data as any),
      // Add metadata about the operation
      metadata: {
        operation_time: new Date().toISOString(),
        operation_type: 'water_flow_analysis',
        input_dem: params.dem_path,
        output_files: [
          params.output_path,
          `${path.parse(params.output_path).name}_streams.gpkg`,
          `${path.parse(params.output_path).name}_flow_acc.tif`,
          `${path.parse(params.output_path).name}_flow_dir.tif`,
          `${path.parse(params.output_path).name}_visualization.png`
        ],
        parameters: {
          flow_method: params.flow_method || 'd8',
          stream_threshold: params.stream_threshold || 100,
          depression_filling: params.depression_filling !== undefined ? params.depression_filling : true,
          output_format: params.output_format || 'geotiff'
        }
      }
    };
  } catch (error) {
    logger.error('Error in water flow analysis', { 
      error: (error as Error).message, 
      stack: (error as Error).stack 
    });
    
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Water flow analysis failed: ${(error as Error).message}`
    );
  }
} 