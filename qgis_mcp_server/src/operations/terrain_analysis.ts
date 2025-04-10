/**
 * Terrain Analysis Operations for QGIS MCP Server
 * 
 * This module implements the terrain analysis operations exposed through the MCP server.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { 
  SlopeAnalysisParams, 
  SlopeAnalysisResponse,
  FlowPathAnalysisParams,
  FlowPathAnalysisResponse
} from '../types/terrain_analysis.js';
import { SlopeUnits, OutputFormat } from '../types/common.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import QGISConnector from '../qgis_connector.js';

// Type definitions
interface TerrainMetadata {
  operation_time: string;
  operation_type: string;
  input_dem: string;
  output_files: string[];
  parameters: Record<string, any>;
}

interface TerrainAnalysisParameters {
  dem_path: string;
  output_path: string;
  analysis_type: 'slope' | 'aspect' | 'hillshade' | 'roughness' | 'tpi' | 'tri';
  output_format?: string;
  z_factor?: number;
  [key: string]: any;
}

interface SlopeParameters extends TerrainAnalysisParameters {
  analysis_type: 'slope';
  slope_format?: 'degrees' | 'percent';
  classification?: 'continuous' | 'classified';
  class_breaks?: number[];
}

interface TerrainStatistics {
  min: number;
  max: number;
  mean: number;
  std_dev: number;
  distribution?: Record<string, number>;
}

interface TerrainAnalysisResponse {
  terrain_raster_path: string;
  visualization_path: string;
  statistics: TerrainStatistics;
  metadata?: TerrainMetadata;
}

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
    logger.error('Failed to create output directory', { error: (error as Error).message });
  }
}

/**
 * Execute a QGIS Python script with parameters
 * 
 * @param scriptName Name of the Python script to execute (without extension)
 * @param parameters Parameters to pass to the script
 * @returns Promise that resolves with the script output
 */
async function executeQGISScript(scriptName: string, parameters: any): Promise<string> {
  // In a real implementation, this would execute a QGIS Python script
  // For Phase 1, we're implementing a mock version that returns simulated results
  
  // Simulate a delay to mimic processing time
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // For now, just return a success message
  return JSON.stringify({
    success: true,
    script: scriptName,
    parameters: parameters
  });
}

/**
 * Calculate slope from a DEM and classify for stormwater management suitability
 * 
 * @param params Slope analysis parameters
 * @returns Slope analysis results
 */
export async function slopeAnalysis(params: SlopeAnalysisParams): Promise<SlopeAnalysisResponse> {
  try {
    // Validate parameters
    if (!params.dem_path || !params.output_path) {
      return {
        success: false,
        error: {
          message: 'Missing required parameters: dem_path and output_path',
          code: 'INVALID_PARAMS'
        }
      };
    }

    // Set default values for optional parameters
    const slopeUnits = params.slope_units || SlopeUnits.PERCENT;
    const outputFormat = params.output_format || OutputFormat.GEOTIFF;
    const classRanges = params.class_ranges || [2, 5, 10, 15, 25];
    const classLabels = params.class_labels || [
      '0-2%', 
      '2-5%', 
      '5-10%', 
      '10-15%',
      '15-25%',
      '>25%'
    ];
    const stormwaterSuitability = params.stormwater_suitability !== undefined ? 
      params.stormwater_suitability : true;

    // In a real implementation, this would execute the actual QGIS analysis
    // For Phase 1, we're returning simulated results
    
    // Mock start time for calculating execution time
    const startTime = Date.now();
    
    // Define output paths based on input parameters
    const outputBasename = path.basename(params.output_path, path.extname(params.output_path));
    const outputDir = path.dirname(params.output_path);
    
    const outputPaths = {
      output_raster: params.output_path,
      visualization: path.join(outputDir, `${outputBasename}_visualization.png`),
      classified_slope: path.join(outputDir, `${outputBasename}_classified.tif`),
      suitability_map: stormwaterSuitability ? 
        path.join(outputDir, `${outputBasename}_suitability.tif`) : undefined
    };
    
    // Define simulated statistics
    const statistics = {
      min_slope: 0.0,
      max_slope: 45.2,
      mean_slope: 12.4,
      median_slope: 8.7,
      std_dev: 7.3
    };
    
    // Define simulated classification results
    const classification = [
      { class: '0-2%', area_sqm: 25000, area_percent: 15, suitability: 'Excellent' },
      { class: '2-5%', area_sqm: 40000, area_percent: 25, suitability: 'Good' },
      { class: '5-10%', area_sqm: 32000, area_percent: 20, suitability: 'Moderate' },
      { class: '10-15%', area_sqm: 28000, area_percent: 18, suitability: 'Limited' },
      { class: '15-25%', area_sqm: 30000, area_percent: 19, suitability: 'Poor' },
      { class: '>25%', area_sqm: 5000, area_percent: 3, suitability: 'Unsuitable' }
    ];
    
    // Define simulated stormwater suitability
    const stormwaterSuitabilityResults = stormwaterSuitability ? {
      bioretention: 'Suitable for 40% of area',
      permeable_pavement: 'Suitable for 15% of area',
      detention: 'Suitable for 75% of area',
      bioswale: 'Suitable for 30% of area'
    } : undefined;
    
    // Calculate execution time
    const executionTime = ((Date.now() - startTime) / 1000).toFixed(1) + 's';
    
    // Return simulated results
    return {
      success: true,
      data: {
        operation: 'slope_analysis',
        paths: outputPaths,
        statistics,
        classification,
        stormwater_suitability: stormwaterSuitabilityResults,
        execution_time: executionTime
      }
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: `Error in slope analysis: ${(error as Error).message}`,
        code: 'PROCESSING_ERROR'
      }
    };
  }
}

/**
 * Analyze flow paths across a terrain for stormwater infrastructure placement
 * 
 * @param params Flow path analysis parameters
 * @returns Flow path analysis results
 */
export async function flowPathAnalysis(params: FlowPathAnalysisParams): Promise<FlowPathAnalysisResponse> {
  try {
    // Validate parameters
    if (!params.dem_path || !params.output_path) {
      return {
        success: false,
        error: {
          message: 'Missing required parameters: dem_path and output_path',
          code: 'INVALID_PARAMS'
        }
      };
    }

    // Set default values for optional parameters
    const algorithm = params.algorithm || 'd-infinity';
    const fillSinks = params.fill_sinks !== undefined ? params.fill_sinks : true;
    const accumulationThreshold = params.accumulation_threshold || 1000;
    
    // In a real implementation, this would execute the actual QGIS analysis
    // For Phase 1, we're returning simulated results
    
    // Mock start time for calculating execution time
    const startTime = Date.now();
    
    // Define output paths based on input parameters
    const outputBasename = path.basename(params.output_path, path.extname(params.output_path));
    const outputDir = path.dirname(params.output_path);
    
    const outputPaths = {
      flow_accumulation: path.join(outputDir, `${outputBasename}_flow_accumulation.tif`),
      flow_direction: path.join(outputDir, `${outputBasename}_flow_direction.tif`),
      stream_network: path.join(outputDir, `${outputBasename}_streams.gpkg`),
      visualization: path.join(outputDir, `${outputBasename}_flow_visualization.png`)
    };
    
    // Define simulated statistics
    const statistics = {
      total_flow_paths: 42,
      main_flow_path_length_m: 1250.5,
      max_accumulation_value: 10568
    };
    
    // Define simulated stormwater implications
    const stormwaterImplications = {
      critical_points: [
        {
          type: 'concentration' as const,
          x: 425678,
          y: 4567890,
          accumulation: 8562
        },
        {
          type: 'outlet' as const,
          x: 425900,
          y: 4567600,
          accumulation: 10568
        }
      ],
      suggested_bmp_locations: [
        {
          type: 'bioretention',
          x: 425700,
          y: 4567920,
          drainage_area_sqm: 25000
        },
        {
          type: 'detention',
          x: 425850,
          y: 4567780,
          drainage_area_sqm: 45000
        }
      ]
    };
    
    // Calculate execution time
    const executionTime = ((Date.now() - startTime) / 1000).toFixed(1) + 's';
    
    // Return simulated results
    return {
      success: true,
      data: {
        operation: 'flow_path_analysis',
        paths: outputPaths,
        statistics,
        stormwater_implications: stormwaterImplications,
        execution_time: executionTime
      }
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: `Error in flow path analysis: ${(error as Error).message}`,
        code: 'PROCESSING_ERROR'
      }
    };
  }
}

/**
 * Performs general terrain analysis
 * @param params - Terrain analysis parameters
 * @returns Analysis results
 */
export async function terrainAnalysis(params: TerrainAnalysisParameters): Promise<TerrainAnalysisResponse> {
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

    if (!params.analysis_type) {
      throw new McpError(
        ErrorCode.InvalidParameters,
        'Missing required parameter: analysis_type'
      );
    }

    // Validate analysis type
    const validTypes = ['slope', 'aspect', 'hillshade', 'roughness', 'tpi', 'tri'];
    if (!validTypes.includes(params.analysis_type)) {
      throw new McpError(
        ErrorCode.InvalidParameters,
        `Invalid analysis_type. Must be one of: ${validTypes.join(', ')}`
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
      analysis_type: params.analysis_type,
      output_format: params.output_format || 'geotiff',
      z_factor: params.z_factor || 1.0,
      ...params // Include any additional parameters
    };

    // Special handling for slope analysis
    if (params.analysis_type === 'slope') {
      requestData.slope_format = (params as SlopeParameters).slope_format || 'degrees';
      requestData.classification = (params as SlopeParameters).classification || 'continuous';
      
      if ((params as SlopeParameters).class_breaks && (params as SlopeParameters).class_breaks.length > 0) {
        requestData.class_breaks = (params as SlopeParameters).class_breaks;
      }
    }

    // Execute request
    logger.info(`Performing ${params.analysis_type} analysis`, { params: requestData });
    
    // Call QGIS server via connector
    const response = await QGISConnector.runAlgorithm(`terrain:${params.analysis_type}`, requestData);
    
    if (!response.success) {
      throw new McpError(
        ErrorCode.InternalError,
        `Terrain analysis failed: ${response.error?.message || 'Unknown error'}`
      );
    }
    
    return {
      ...(response.data as any),
      // Add metadata about the operation
      metadata: {
        operation_time: new Date().toISOString(),
        operation_type: `${params.analysis_type}_analysis`,
        input_dem: params.dem_path,
        output_files: [
          params.output_path,
          `${path.parse(params.output_path).name}_visualization.png`
        ],
        parameters: {
          ...params,
          dem_path: demPath,
          output_path: outputPath
        }
      }
    };
  } catch (error) {
    logger.error('Error in terrain analysis', { 
      error: (error as Error).message, 
      stack: (error as Error).stack 
    });
    
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Terrain analysis failed: ${(error as Error).message}`
    );
  }
}

/**
 * Performs slope analysis, a specific type of terrain analysis
 * @param params - Slope analysis parameters
 * @returns Analysis results
 */
export async function slopeAnalysis(params: SlopeParameters): Promise<TerrainAnalysisResponse> {
  return terrainAnalysis({
    ...params,
    analysis_type: 'slope'
  });
}
