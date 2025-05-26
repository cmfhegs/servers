/**
 * Runoff Analysis Operations for MCP Server
 * 
 * This module implements runoff analysis operations that communicate with the QGIS container.
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import QGISConnector from '../qgis_connector.js';

// Define parameter types
interface RunoffAnalysisParams {
  dem_path: string;
  output_path: string;
  precipitation_data?: {
    amount: number;
    duration: number;
    return_period?: number;
    temporal_distribution?: string;
  };
  soil_data_path?: string;
  land_cover_path?: string;
  flow_direction_path?: string;
  flow_accumulation_path?: string;
  curve_number_method?: boolean;
  time_to_peak?: number;
  include_hydrograph?: boolean;
  output_format?: string;
}

interface RunoffAnalysisResponse {
  runoff_layer_path: string;
  visualization_path: string;
  hydrograph_path?: string;
  statistics: {
    mean_runoff_depth: number;
    peak_runoff: number;
    total_runoff_volume: number;
    time_to_concentration: number;
    runoff_coefficient: number;
    area_distribution: {
      high_runoff: number;
      moderate_runoff: number;
      low_runoff: number;
      very_low_runoff: number;
    };
  };
  metadata?: {
    operation_time: string;
    operation_type: string;
    input_dem: string;
    input_soil: string;
    input_land_cover: string;
    precipitation_details: {
      amount: number;
      duration: number;
      return_period: number;
      temporal_distribution: string;
    };
    output_files: string[];
    parameters: {
      curve_number_method: boolean;
      time_to_peak: number;
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
  defaultMeta: { service: 'runoff-analysis' },
  transports: [
    new winston.transports.File({ filename: 'runoff-analysis-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'runoff-analysis.log' }),
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
 * Executes runoff analysis using the QGIS server
 * @param params - Runoff analysis parameters
 * @returns Analysis results
 */
export async function runoffAnalysis(params: RunoffAnalysisParams): Promise<RunoffAnalysisResponse> {
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

    // Handle optional soil data path
    let soilDataPath = null;
    if (params.soil_data_path) {
      soilDataPath = path.isAbsolute(params.soil_data_path)
        ? params.soil_data_path
        : path.join(DATA_DIR, params.soil_data_path);
      
      if (!fs.existsSync(soilDataPath)) {
        throw new McpError(
          ErrorCode.InvalidParameters,
          `Soil data file not found: ${soilDataPath}`
        );
      }
    }

    // Handle optional land cover path
    let landCoverPath = null;
    if (params.land_cover_path) {
      landCoverPath = path.isAbsolute(params.land_cover_path)
        ? params.land_cover_path
        : path.join(DATA_DIR, params.land_cover_path);
      
      if (!fs.existsSync(landCoverPath)) {
        throw new McpError(
          ErrorCode.InvalidParameters,
          `Land cover file not found: ${landCoverPath}`
        );
      }
    }

    // Handle optional flow direction path
    let flowDirectionPath = null;
    if (params.flow_direction_path) {
      flowDirectionPath = path.isAbsolute(params.flow_direction_path)
        ? params.flow_direction_path
        : path.join(DATA_DIR, params.flow_direction_path);
      
      if (!fs.existsSync(flowDirectionPath)) {
        throw new McpError(
          ErrorCode.InvalidParameters,
          `Flow direction file not found: ${flowDirectionPath}`
        );
      }
    }

    // Handle optional flow accumulation path
    let flowAccumulationPath = null;
    if (params.flow_accumulation_path) {
      flowAccumulationPath = path.isAbsolute(params.flow_accumulation_path)
        ? params.flow_accumulation_path
        : path.join(DATA_DIR, params.flow_accumulation_path);
      
      if (!fs.existsSync(flowAccumulationPath)) {
        throw new McpError(
          ErrorCode.InvalidParameters,
          `Flow accumulation file not found: ${flowAccumulationPath}`
        );
      }
    }

    // Define default precipitation data if not provided
    const precipitationData = params.precipitation_data || {
      amount: 25,  // mm
      duration: 1,  // hours
      return_period: 2,  // years
      temporal_distribution: 'uniform'
    };

    // Prepare request payload
    const requestData: RunoffAnalysisParams = {
      dem_path: demPath,
      output_path: outputPath,
      precipitation_data: {
        amount: precipitationData.amount,
        duration: precipitationData.duration,
        return_period: precipitationData.return_period || 2,
        temporal_distribution: precipitationData.temporal_distribution || 'uniform'
      },
      soil_data_path: soilDataPath,
      land_cover_path: landCoverPath,
      flow_direction_path: flowDirectionPath,
      flow_accumulation_path: flowAccumulationPath,
      curve_number_method: params.curve_number_method !== undefined 
        ? params.curve_number_method 
        : true,
      time_to_peak: params.time_to_peak || 0.5,  // 0.5 hours default
      include_hydrograph: params.include_hydrograph !== undefined 
        ? params.include_hydrograph 
        : true,
      output_format: params.output_format || 'geotiff'
    };

    // Execute request
    logger.info('Performing runoff analysis', { params: requestData });
    
    // Call QGIS server via connector
    const response = await QGISConnector.performRunoffAnalysis(requestData);
    
    if (!response.success) {
      throw new McpError(
        ErrorCode.InternalError,
        `Runoff analysis failed: ${response.error?.message || 'Unknown error'}`
      );
    }
    
    // Construct output file paths for metadata
    const baseOutputName = path.parse(outputPath).name;
    const outputFiles = [outputPath, `${baseOutputName}_visualization.png`];
    
    if (params.include_hydrograph) {
      outputFiles.push(`${baseOutputName}_hydrograph.png`);
    }
    
    return {
      ...(response.data as any),
      // Add metadata about the operation
      metadata: {
        operation_time: new Date().toISOString(),
        operation_type: 'runoff_analysis',
        input_dem: params.dem_path,
        input_soil: params.soil_data_path || 'Generated from DEM',
        input_land_cover: params.land_cover_path || 'Default classification',
        precipitation_details: {
          amount: precipitationData.amount,
          duration: precipitationData.duration,
          return_period: precipitationData.return_period || 2,
          temporal_distribution: precipitationData.temporal_distribution || 'uniform'
        },
        output_files: outputFiles,
        parameters: {
          curve_number_method: params.curve_number_method !== undefined 
            ? params.curve_number_method 
            : true,
          time_to_peak: params.time_to_peak || 0.5,
          output_format: params.output_format || 'geotiff'
        }
      }
    };
  } catch (error) {
    logger.error('Error in runoff analysis', { 
      error: (error as Error).message, 
      stack: (error as Error).stack 
    });
    
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Runoff analysis failed: ${(error as Error).message}`
    );
  }
} 