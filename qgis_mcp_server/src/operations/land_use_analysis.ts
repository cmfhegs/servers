/**
 * Land Use Analysis Operations for MCP Server
 * 
 * This module implements land use analysis operations that communicate with the QGIS container.
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import QGISConnector from '../qgis_connector.js';

// Define parameter types
interface LandUseAnalysisParams {
  dem_path: string;
  output_path: string;
  land_use_data_path?: string;
  land_use_database?: string;
  reference_year?: number;
  include_change_analysis?: boolean;
  end_year?: number;
  buffer_distance?: number;
  class_filter?: string[];
  output_format?: string;
}

interface LandUseAnalysisResponse {
  land_use_layer_path: string;
  visualization_path: string;
  statistics: {
    land_use_distribution: Record<string, number>;
    dominant_land_use: string;
    biodiversity_index?: number;
    fragmentation_metrics?: {
      edge_density: number;
      patch_count: number;
      contagion: number;
    };
    change_metrics?: {
      net_change_by_class: Record<string, number>;
      total_area_changed: number;
      percentage_changed: number;
    };
  };
  metadata?: {
    operation_time: string;
    operation_type: string;
    input_dem: string;
    land_use_data: string;
    reference_year: number;
    end_year?: number;
    output_files: string[];
    parameters: {
      land_use_database: string;
      buffer_distance: number;
      include_change_analysis: boolean;
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
  defaultMeta: { service: 'land-use-analysis' },
  transports: [
    new winston.transports.File({ filename: 'land-use-analysis-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'land-use-analysis.log' }),
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
 * Executes land use analysis using the QGIS server
 * @param params - Land use analysis parameters
 * @returns Analysis results
 */
export async function landUseAnalysis(params: LandUseAnalysisParams): Promise<LandUseAnalysisResponse> {
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

    const landUseDataPath = params.land_use_data_path 
      ? (path.isAbsolute(params.land_use_data_path) 
          ? params.land_use_data_path 
          : path.join(DATA_DIR, params.land_use_data_path))
      : null;

    // Ensure DEM file exists
    if (!fs.existsSync(demPath)) {
      throw new McpError(
        ErrorCode.InvalidParameters,
        `DEM file not found: ${demPath}`
      );
    }

    // Check if land use data file exists if provided
    if (landUseDataPath && !fs.existsSync(landUseDataPath)) {
      throw new McpError(
        ErrorCode.InvalidParameters,
        `Land use data file not found: ${landUseDataPath}`
      );
    }

    // Prepare request payload
    const requestData: LandUseAnalysisParams = {
      dem_path: demPath,
      output_path: outputPath,
      land_use_data_path: landUseDataPath,
      land_use_database: params.land_use_database || 'nlcd',
      reference_year: params.reference_year || (new Date()).getFullYear(),
      include_change_analysis: params.include_change_analysis || false,
      end_year: params.end_year,
      buffer_distance: params.buffer_distance || 0,
      class_filter: params.class_filter || [],
      output_format: params.output_format || 'geojson'
    };

    // Execute request
    logger.info('Performing land use analysis', { params: requestData });
    
    // Call QGIS server via connector
    const response = await QGISConnector.performLandUseAnalysis(requestData);
    
    if (!response.success) {
      throw new McpError(
        ErrorCode.InternalError,
        `Land use analysis failed: ${response.error?.message || 'Unknown error'}`
      );
    }
    
    return {
      ...(response.data as any),
      // Add metadata about the operation
      metadata: {
        operation_time: new Date().toISOString(),
        operation_type: 'land_use_analysis',
        input_dem: params.dem_path,
        land_use_data: params.land_use_data_path || 'Not provided',
        reference_year: params.reference_year || (new Date()).getFullYear(),
        end_year: params.end_year,
        output_files: [
          params.output_path,
          `${path.parse(params.output_path).name}_visualization.png`
        ],
        parameters: {
          land_use_database: params.land_use_database || 'nlcd',
          buffer_distance: params.buffer_distance || 0,
          include_change_analysis: params.include_change_analysis || false,
          output_format: params.output_format || 'geojson'
        }
      }
    };
  } catch (error) {
    logger.error('Error in land use analysis', { 
      error: (error as Error).message, 
      stack: (error as Error).stack 
    });
    
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Land use analysis failed: ${(error as Error).message}`
    );
  }
} 