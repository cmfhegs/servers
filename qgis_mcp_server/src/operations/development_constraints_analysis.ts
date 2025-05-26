/**
 * Development Constraints Analysis Operations for MCP Server
 * 
 * This module implements development constraints analysis operations that communicate with the QGIS container.
 */

import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import QGISConnector from '../qgis_connector.js';

// Define parameter types
interface DevelopmentConstraintsAnalysisParams {
  dem_path: string;
  output_path: string;
  constraint_layers?: {
    slope?: {
      max_buildable_slope: number;
      path?: string;
    };
    flood_risk?: {
      include: boolean;
      buffer_distance?: number;
      path?: string;
    };
    wetlands?: {
      include: boolean;
      buffer_distance?: number;
      path?: string;
    };
    protected_areas?: {
      include: boolean;
      buffer_distance?: number;
      path?: string;
    };
    water_bodies?: {
      include: boolean;
      buffer_distance?: number;
      path?: string;
    };
    custom?: Array<{
      name: string;
      path: string;
      buffer_distance?: number;
      weight?: number;
    }>;
  };
  weight_factors?: {
    slope_weight?: number;
    flood_risk_weight?: number;
    wetlands_weight?: number;
    protected_areas_weight?: number;
    water_bodies_weight?: number;
  };
  output_format?: string;
}

interface DevelopmentConstraintsAnalysisResponse {
  constraints_layer_path: string;
  visualization_path: string;
  statistics: {
    total_area: number;
    buildable_area: number;
    constrained_area: number;
    constraints_by_type: Record<string, {
      area: number;
      percentage: number;
    }>;
  };
  metadata?: {
    operation_time: string;
    operation_type: string;
    input_dem: string;
    output_files: string[];
    parameters: {
      constraint_types: string[];
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
  defaultMeta: { service: 'development-constraints-analysis' },
  transports: [
    new winston.transports.File({ filename: 'development-constraints-analysis-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'development-constraints-analysis.log' }),
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
 * Executes development constraints analysis using the QGIS server
 * @param params - Development constraints analysis parameters
 * @returns Analysis results
 */
export async function developmentConstraintsAnalysis(params: DevelopmentConstraintsAnalysisParams): Promise<DevelopmentConstraintsAnalysisResponse> {
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

    // Resolve constraint layer paths and validate they exist
    let constraintLayers = params.constraint_layers || {};
    
    // Process constraint layer paths
    if (constraintLayers.slope?.path) {
      const slopePath = path.isAbsolute(constraintLayers.slope.path)
        ? constraintLayers.slope.path
        : path.join(DATA_DIR, constraintLayers.slope.path);
        
      if (!fs.existsSync(slopePath)) {
        throw new McpError(
          ErrorCode.InvalidParameters,
          `Slope data file not found: ${slopePath}`
        );
      }
      
      constraintLayers.slope.path = slopePath;
    }
    
    // Process flood risk layer
    if (constraintLayers.flood_risk?.include && constraintLayers.flood_risk.path) {
      const floodRiskPath = path.isAbsolute(constraintLayers.flood_risk.path)
        ? constraintLayers.flood_risk.path
        : path.join(DATA_DIR, constraintLayers.flood_risk.path);
        
      if (!fs.existsSync(floodRiskPath)) {
        throw new McpError(
          ErrorCode.InvalidParameters,
          `Flood risk data file not found: ${floodRiskPath}`
        );
      }
      
      constraintLayers.flood_risk.path = floodRiskPath;
    }
    
    // Process wetlands layer
    if (constraintLayers.wetlands?.include && constraintLayers.wetlands.path) {
      const wetlandsPath = path.isAbsolute(constraintLayers.wetlands.path)
        ? constraintLayers.wetlands.path
        : path.join(DATA_DIR, constraintLayers.wetlands.path);
        
      if (!fs.existsSync(wetlandsPath)) {
        throw new McpError(
          ErrorCode.InvalidParameters,
          `Wetlands data file not found: ${wetlandsPath}`
        );
      }
      
      constraintLayers.wetlands.path = wetlandsPath;
    }
    
    // Process protected areas layer
    if (constraintLayers.protected_areas?.include && constraintLayers.protected_areas.path) {
      const protectedAreasPath = path.isAbsolute(constraintLayers.protected_areas.path)
        ? constraintLayers.protected_areas.path
        : path.join(DATA_DIR, constraintLayers.protected_areas.path);
        
      if (!fs.existsSync(protectedAreasPath)) {
        throw new McpError(
          ErrorCode.InvalidParameters,
          `Protected areas data file not found: ${protectedAreasPath}`
        );
      }
      
      constraintLayers.protected_areas.path = protectedAreasPath;
    }
    
    // Process water bodies layer
    if (constraintLayers.water_bodies?.include && constraintLayers.water_bodies.path) {
      const waterBodiesPath = path.isAbsolute(constraintLayers.water_bodies.path)
        ? constraintLayers.water_bodies.path
        : path.join(DATA_DIR, constraintLayers.water_bodies.path);
        
      if (!fs.existsSync(waterBodiesPath)) {
        throw new McpError(
          ErrorCode.InvalidParameters,
          `Water bodies data file not found: ${waterBodiesPath}`
        );
      }
      
      constraintLayers.water_bodies.path = waterBodiesPath;
    }
    
    // Process custom constraint layers
    if (constraintLayers.custom && constraintLayers.custom.length > 0) {
      for (let i = 0; i < constraintLayers.custom.length; i++) {
        const customLayer = constraintLayers.custom[i];
        const customPath = path.isAbsolute(customLayer.path)
          ? customLayer.path
          : path.join(DATA_DIR, customLayer.path);
          
        if (!fs.existsSync(customPath)) {
          throw new McpError(
            ErrorCode.InvalidParameters,
            `Custom constraint data file not found: ${customPath}`
          );
        }
        
        constraintLayers.custom[i].path = customPath;
      }
    }

    // Prepare request payload
    const requestData: DevelopmentConstraintsAnalysisParams = {
      dem_path: demPath,
      output_path: outputPath,
      constraint_layers: constraintLayers,
      weight_factors: params.weight_factors || {
        slope_weight: 1.0,
        flood_risk_weight: 1.0,
        wetlands_weight: 1.0,
        protected_areas_weight: 1.0,
        water_bodies_weight: 1.0
      },
      output_format: params.output_format || 'geojson'
    };

    // Get constraint types for metadata
    const constraintTypes: string[] = [];
    if (constraintLayers.slope) constraintTypes.push('Slope');
    if (constraintLayers.flood_risk?.include) constraintTypes.push('Flood Risk');
    if (constraintLayers.wetlands?.include) constraintTypes.push('Wetlands');
    if (constraintLayers.protected_areas?.include) constraintTypes.push('Protected Areas');
    if (constraintLayers.water_bodies?.include) constraintTypes.push('Water Bodies');
    if (constraintLayers.custom) {
      constraintLayers.custom.forEach(custom => {
        constraintTypes.push(`Custom: ${custom.name}`);
      });
    }

    // Execute request
    logger.info('Performing development constraints analysis', { params: requestData });
    
    // Call QGIS server via connector
    const response = await QGISConnector.performDevelopmentConstraintsAnalysis(requestData);
    
    if (!response.success) {
      throw new McpError(
        ErrorCode.InternalError,
        `Development constraints analysis failed: ${response.error?.message || 'Unknown error'}`
      );
    }
    
    return {
      ...(response.data as any),
      // Add metadata about the operation
      metadata: {
        operation_time: new Date().toISOString(),
        operation_type: 'development_constraints_analysis',
        input_dem: params.dem_path,
        output_files: [
          params.output_path,
          `${path.parse(params.output_path).name}_visualization.png`
        ],
        parameters: {
          constraint_types: constraintTypes,
          output_format: params.output_format || 'geojson'
        }
      }
    };
  } catch (error) {
    logger.error('Error in development constraints analysis', { 
      error: (error as Error).message, 
      stack: (error as Error).stack 
    });
    
    if (error instanceof McpError) {
      throw error;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `Development constraints analysis failed: ${(error as Error).message}`
    );
  }
} 