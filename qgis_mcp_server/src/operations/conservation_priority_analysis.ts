/**
 * Conservation Priority Analysis Operations for MCP Server
 * 
 * This module implements conservation priority analysis operations that communicate with the QGIS container.
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import QGISConnector from '../qgis_connector.js';

// Define parameter types
interface ConservationPriorityAnalysisParams {
  dem_path: string;
  output_path: string;
  land_cover_path?: string;
  protected_areas_path?: string;
  biodiversity_data_path?: string;
  ecosystem_services_path?: string;
  habitat_connectivity_path?: string;
  conservation_factors?: {
    biodiversity?: number;
    habitat_connectivity?: number;
    ecosystem_services?: number;
    rarity?: number;
    threat_level?: number;
  };
  threat_data_path?: string;
  include_separate_layers?: boolean;
  priority_levels?: number;
  output_format?: string;
}

interface ConservationPriorityAnalysisResponse {
  priority_layer_path: string;
  protected_areas_layer_path?: string;
  visualization_path: string;
  statistics: {
    conservation_area_total: number;
    priority_distribution: {
      very_high: number;
      high: number;
      moderate: number;
      low: number;
      very_low: number;
    };
    protected_areas_coverage: number;
    priority_factors_contribution: {
      biodiversity: number;
      habitat_connectivity: number;
      ecosystem_services: number;
      rarity: number;
      threat_level: number;
    };
  };
  metadata?: {
    operation_time: string;
    operation_type: string;
    input_dem: string;
    input_land_cover: string;
    input_protected_areas: string;
    output_files: string[];
    parameters: {
      conservation_factors: Record<string, number>;
      priority_levels: number;
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
  defaultMeta: { service: 'conservation-priority-analysis' },
  transports: [
    new winston.transports.File({ filename: 'conservation-priority-analysis-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'conservation-priority-analysis.log' }),
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
 * Executes conservation priority analysis using the QGIS server
 * @param params - Conservation priority analysis parameters
 * @returns Analysis results
 */
export async function conservationPriorityAnalysis(params: ConservationPriorityAnalysisParams): Promise<ConservationPriorityAnalysisResponse> {
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

    // Handle optional protected areas path
    let protectedAreasPath = null;
    if (params.protected_areas_path) {
      protectedAreasPath = path.isAbsolute(params.protected_areas_path)
        ? params.protected_areas_path
        : path.join(DATA_DIR, params.protected_areas_path);
      
      if (!fs.existsSync(protectedAreasPath)) {
        throw new McpError(
          ErrorCode.InvalidParameters,
          `Protected areas file not found: ${protectedAreasPath}`
        );
      }
    }

    // Handle optional biodiversity data path
    let biodiversityDataPath = null;
    if (params.biodiversity_data_path) {
      biodiversityDataPath = path.isAbsolute(params.biodiversity_data_path)
        ? params.biodiversity_data_path
        : path.join(DATA_DIR, params.biodiversity_data_path);
      
      if (!fs.existsSync(biodiversityDataPath)) {
        throw new McpError(
          ErrorCode.InvalidParameters,
          `Biodiversity data file not found: ${biodiversityDataPath}`
        );
      }
    }

    // Handle optional ecosystem services path
    let ecosystemServicesPath = null;
    if (params.ecosystem_services_path) {
      ecosystemServicesPath = path.isAbsolute(params.ecosystem_services_path)
        ? params.ecosystem_services_path
        : path.join(DATA_DIR, params.ecosystem_services_path);
      
      if (!fs.existsSync(ecosystemServicesPath)) {
        throw new McpError(
          ErrorCode.InvalidParameters,
          `Ecosystem services file not found: ${ecosystemServicesPath}`
        );
      }
    }
    
    // Handle optional habitat connectivity path
    let habitatConnectivityPath = null;
    if (params.habitat_connectivity_path) {
      habitatConnectivityPath = path.isAbsolute(params.habitat_connectivity_path)
        ? params.habitat_connectivity_path
        : path.join(DATA_DIR, params.habitat_connectivity_path);
      
      if (!fs.existsSync(habitatConnectivityPath)) {
        throw new McpError(
          ErrorCode.InvalidParameters,
          `Habitat connectivity file not found: ${habitatConnectivityPath}`
        );
      }
    }

    // Handle optional threat data path
    let threatDataPath = null;
    if (params.threat_data_path) {
      threatDataPath = path.isAbsolute(params.threat_data_path)
        ? params.threat_data_path
        : path.join(DATA_DIR, params.threat_data_path);
      
      if (!fs.existsSync(threatDataPath)) {
        throw new McpError(
          ErrorCode.InvalidParameters,
          `Threat data file not found: ${threatDataPath}`
        );
      }
    }

    // Define default conservation factors if not provided
    const conservationFactors = params.conservation_factors || {
      biodiversity: 1.0,
      habitat_connectivity: 1.0,
      ecosystem_services: 1.0,
      rarity: 0.8,
      threat_level: 0.8
    };

    // Normalize conservation factors to ensure they sum to 1.0
    const totalWeight = Object.values(conservationFactors).reduce((sum, weight) => sum + weight, 0);
    const normalizedFactors: Record<string, number> = {};
    
    Object.entries(conservationFactors).forEach(([factor, weight]) => {
      normalizedFactors[factor] = weight / totalWeight;
    });

    // Prepare request payload
    const requestData: ConservationPriorityAnalysisParams = {
      dem_path: demPath,
      output_path: outputPath,
      land_cover_path: landCoverPath,
      protected_areas_path: protectedAreasPath,
      biodiversity_data_path: biodiversityDataPath,
      ecosystem_services_path: ecosystemServicesPath,
      habitat_connectivity_path: habitatConnectivityPath,
      conservation_factors: normalizedFactors,
      threat_data_path: threatDataPath,
      include_separate_layers: params.include_separate_layers !== undefined 
        ? params.include_separate_layers 
        : true,
      priority_levels: params.priority_levels || 5,
      output_format: params.output_format || 'geotiff'
    };

    // Execute request
    logger.info('Performing conservation priority analysis', { params: requestData });
    
    // Call QGIS server via connector
    const response = await QGISConnector.performConservationPriorityAnalysis(requestData);
    
    if (!response.success) {
      throw new McpError(
        ErrorCode.InternalError,
        `Conservation priority analysis failed: ${response.error?.message || 'Unknown error'}`
      );
    }
    
    // Construct output file paths for metadata
    const baseOutputName = path.parse(outputPath).name;
    const outputFiles = [outputPath, `${baseOutputName}_visualization.png`];
    
    if (params.include_separate_layers) {
      outputFiles.push(`${baseOutputName}_protected_areas.tif`);
      outputFiles.push(`${baseOutputName}_biodiversity.tif`);
      outputFiles.push(`${baseOutputName}_connectivity.tif`);
      outputFiles.push(`${baseOutputName}_ecosystem_services.tif`);
      outputFiles.push(`${baseOutputName}_threat.tif`);
    }
    
    return {
      ...(response.data as any),
      // Add metadata about the operation
      metadata: {
        operation_time: new Date().toISOString(),
        operation_type: 'conservation_priority_analysis',
        input_dem: params.dem_path,
        input_land_cover: params.land_cover_path || 'Generated from DEM',
        input_protected_areas: params.protected_areas_path || 'No protected areas data provided',
        output_files: outputFiles,
        parameters: {
          conservation_factors: normalizedFactors,
          priority_levels: params.priority_levels || 5,
          output_format: params.output_format || 'geotiff'
        }
      }
    };
  } catch (error) {
    logger.error('Error in conservation priority analysis', { 
      error: (error as Error).message, 
      stack: (error as Error).stack 
    });
    
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Conservation priority analysis failed: ${(error as Error).message}`
    );
  }
} 