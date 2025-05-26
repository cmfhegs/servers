#!/usr/bin/env node
/**
 * QGIS MCP Server
 * 
 * This server exposes QGIS operations through the Model Context Protocol (MCP)
 * for stormwater management applications.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import winston from 'winston';

// Import operations
import { slopeAnalysis } from './operations/terrain_analysis.js';
import { watershedAnalysis } from './operations/watershed_analysis.js';
import { aspectAnalysis } from './operations/aspect_analysis.js';
import { viewshedAnalysis } from './operations/viewshed_analysis.js';
import { executeTemperatureGradientsAnalysis } from './operations/temperature_gradients_analysis.js';
import { executeDrainagePatternAnalysis } from './operations/drainage_pattern_analysis.js';
import { executeMicroclimateAnalysis } from './operations/microclimate_analysis.js';
import { executeWindPatternsAnalysis } from './operations/wind_patterns_analysis.js';
import { executeHabitatConnectivityAnalysis } from './operations/habitat_connectivity_analysis.js';
import { executeSunExposureAnalysis } from './operations/sun_exposure_analysis.js';
import { executeBiodiversityPotentialAnalysis } from './operations/biodiversity_potential_analysis.js';
import { SlopeAnalysisParams } from './types/terrain_analysis.js';
import { WatershedAnalysisParams } from './types/watershed_analysis.js';
import { AspectAnalysisParams } from './types/aspect_analysis.js';
import { ViewshedAnalysisParams } from './types/viewshed_analysis.js';

// Import additional parameter types for new operations
interface TemperatureGradientsParams {
  dem_path: string;
  output_path: string;
  land_cover_path?: string;
  season?: string;
  time_of_day?: string;
  latitude?: number;
  humidity_data?: string;
  wind_data?: string;
  output_format?: string;
}

interface DrainagePatternParams {
  dem_path: string;
  output_path: string;
  flow_accumulation_threshold?: number;
  stream_order_method?: string;
  include_catchments?: boolean;
  fill_sinks?: boolean;
  output_format?: string;
}

interface MicroclimateParams {
  dem_path: string;
  output_path: string;
  land_cover_path?: string;
  wind_data_path?: string;
  humidity_data_path?: string;
  season?: string;
  time_of_day?: string;
  output_format?: string;
}

interface WindPatternsParams {
  dem_path: string;
  output_path: string;
  wind_direction?: number;
  wind_speed?: number;
  land_cover_path?: string;
  season?: string;
  output_format?: string;
}

interface HabitatConnectivityParams {
  dem_path: string;
  output_path: string;
  land_cover_path?: string;
  habitat_areas_path?: string;
  target_species?: string;
  max_cost_distance?: number;
  corridor_width?: number;
  output_format?: string;
}

interface SunExposureParams {
  dem_path: string;
  output_path: string;
  latitude?: number;
  longitude?: number;
  seasons?: string;
  day_hours?: string;
  sky_model?: string;
  output_format?: string;
}

interface BiodiversityPotentialParams {
  dem_path: string;
  output_path: string;
  land_cover_path?: string;
  distance_to_water?: boolean;
  edge_density?: boolean;
  elevation_range?: boolean;
  habitat_diversity_weight?: number;
  connectivity_weight?: number;
  elevation_weight?: number;
  water_weight?: number;
  output_format?: string;
}

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'qgis-mcp-server' },
  transports: [
    new winston.transports.File({ filename: 'qgis-mcp-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'qgis-mcp.log' })
  ]
});

// Add console transport if not in production
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Create QGIS execution environment check
const checkQGISEnvironment = async (): Promise<boolean> => {
  try {
    // Add logic to check if QGIS is available and properly configured
    // For now, return true as a placeholder
    return true;
  } catch (error) {
    logger.error('QGIS environment check failed', { error });
    return false;
  }
};

class QGISMCPServer {
  private server: Server;
  private qgisAvailable: boolean = false;

  constructor() {
    this.server = new Server(
      {
        name: 'qgis-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Set up server event handlers
    this.server.onerror = (error) => {
      logger.error('MCP server error', { error });
    };

    // Set up request handlers
    this.setupHandlers();

    // Set up process event handlers
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      if (!this.qgisAvailable) {
        throw new McpError(
          ErrorCode.InternalError,
          'QGIS environment is not available'
        );
      }

      return {
        tools: [
          {
            name: 'qgis:slope_analysis',
            description: 'Calculate slope values from a DEM and classify them for stormwater management suitability',
            inputSchema: {
              type: 'object',
              properties: {
                dem_path: { 
                  type: 'string',
                  description: 'Path to the DEM file'
                },
                output_path: { 
                  type: 'string', 
                  description: 'Path to save the output slope raster'
                },
                output_format: { 
                  type: 'string',
                  enum: ['geotiff', 'gpkg', 'png'],
                  description: 'Format for the output'
                },
                slope_units: { 
                  type: 'string',
                  enum: ['degrees', 'percent'],
                  description: 'Units for slope measurement'
                },
                class_ranges: { 
                  type: 'array',
                  items: { type: 'number' },
                  description: 'Slope classification breakpoints'
                },
                class_labels: { 
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Labels for slope classes'
                },
                stormwater_suitability: { 
                  type: 'boolean',
                  description: 'Include stormwater management suitability analysis'
                }
              },
              required: ['dem_path', 'output_path']
            }
          },
          {
            name: 'qgis:watershed_analysis',
            description: 'Analyze watersheds and stream networks from a DEM',
            inputSchema: {
              type: 'object',
              properties: {
                dem_path: {
                  type: 'string',
                  description: 'Path to the DEM file'
                },
                output_path: {
                  type: 'string',
                  description: 'Path to save the output files'
                },
                flow_accumulation_threshold: {
                  type: 'number',
                  description: 'Minimum flow accumulation value to define a stream'
                },
                pour_points: {
                  type: 'string',
                  description: 'Optional path to pour points vector file'
                },
                fill_sinks: {
                  type: 'boolean',
                  description: 'Fill sinks in the DEM before processing'
                },
                flow_algorithm: {
                  type: 'string',
                  enum: ['d8', 'd-infinity', 'mfd'],
                  description: 'Flow routing algorithm'
                }
              },
              required: ['dem_path', 'output_path']
            }
          },
          {
            name: 'qgis:aspect_analysis',
            description: 'Calculate aspect (slope direction) from a DEM',
            inputSchema: {
              type: 'object',
              properties: {
                dem_path: {
                  type: 'string',
                  description: 'Path to the DEM file'
                },
                output_path: {
                  type: 'string',
                  description: 'Path to save the output files'
                },
                categories: {
                  type: 'number',
                  description: 'Number of aspect categories to classify'
                },
                output_format: {
                  type: 'string',
                  enum: ['geotiff', 'gpkg', 'png'],
                  description: 'Format for the output'
                },
                include_flat: {
                  type: 'boolean',
                  description: 'Whether to include flat areas as a separate category'
                },
                category_labels: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional custom labels for aspect categories'
                }
              },
              required: ['dem_path', 'output_path']
            }
          },
          {
            name: 'qgis:viewshed_analysis',
            description: 'Calculate visible areas from observer points',
            inputSchema: {
              type: 'object',
              properties: {
                dem_path: {
                  type: 'string',
                  description: 'Path to the DEM file'
                },
                output_path: {
                  type: 'string',
                  description: 'Path to save the output files'
                },
                observer_height: {
                  type: 'number',
                  description: 'Height of the observer in meters'
                },
                radius: {
                  type: 'number',
                  description: 'Maximum visibility radius in meters'
                },
                view_angle: {
                  type: 'number',
                  description: 'View angle in degrees (1-360)'
                },
                observer_points: {
                  type: 'string',
                  description: 'Optional path to observer points vector file'
                },
                output_format: {
                  type: 'string',
                  enum: ['geotiff', 'gpkg', 'png'],
                  description: 'Format for the output'
                },
                include_invisibility: {
                  type: 'boolean',
                  description: 'Whether to include invisible areas'
                }
              },
              required: ['dem_path', 'output_path']
            }
          },
          {
            name: 'qgis:temperature_gradients_analysis',
            description: 'Analyze temperature variations and thermal patterns across the landscape',
            inputSchema: {
              type: 'object',
              properties: {
                dem_path: {
                  type: 'string',
                  description: 'Path to the DEM file'
                },
                output_path: {
                  type: 'string',
                  description: 'Path to save the output files'
                },
                land_cover_path: {
                  type: 'string',
                  description: 'Optional path to land cover raster'
                },
                season: {
                  type: 'string',
                  enum: ['summer', 'winter', 'spring', 'fall'],
                  description: 'Season for temperature analysis'
                },
                time_of_day: {
                  type: 'string',
                  enum: ['morning', 'afternoon', 'evening', 'night'],
                  description: 'Time of day for analysis'
                },
                latitude: {
                  type: 'number',
                  description: 'Site latitude in decimal degrees'
                },
                humidity_data: {
                  type: 'string',
                  description: 'Optional path to humidity data'
                },
                wind_data: {
                  type: 'string',
                  description: 'Optional path to wind data'
                },
                output_format: {
                  type: 'string',
                  enum: ['geotiff', 'gpkg', 'png'],
                  description: 'Format for the output'
                }
              },
              required: ['dem_path', 'output_path']
            }
          },
          {
            name: 'qgis:drainage_pattern_analysis',
            description: 'Analyze drainage networks, flow paths, and catchment areas across a landscape',
            inputSchema: {
              type: 'object',
              properties: {
                dem_path: {
                  type: 'string',
                  description: 'Path to the DEM file'
                },
                output_path: {
                  type: 'string',
                  description: 'Path to save the output files'
                },
                flow_accumulation_threshold: {
                  type: 'number',
                  description: 'Threshold for stream definition'
                },
                stream_order_method: {
                  type: 'string',
                  enum: ['strahler', 'shreve'],
                  description: 'Method for stream ordering'
                },
                include_catchments: {
                  type: 'boolean',
                  description: 'Whether to include catchment delineation'
                },
                fill_sinks: {
                  type: 'boolean',
                  description: 'Whether to fill DEM sinks before analysis'
                },
                output_format: {
                  type: 'string',
                  enum: ['geotiff', 'gpkg', 'png'],
                  description: 'Format for the output'
                }
              },
              required: ['dem_path', 'output_path']
            }
          },
          {
            name: 'qgis:microclimate_analysis',
            description: 'Analyze microclimatic conditions by combining temperature, wind, and humidity patterns',
            inputSchema: {
              type: 'object',
              properties: {
                dem_path: {
                  type: 'string',
                  description: 'Path to the DEM file'
                },
                output_path: {
                  type: 'string',
                  description: 'Path to save the output files'
                },
                land_cover_path: {
                  type: 'string',
                  description: 'Optional path to land cover raster'
                },
                wind_data_path: {
                  type: 'string',
                  description: 'Optional path to wind data raster'
                },
                humidity_data_path: {
                  type: 'string',
                  description: 'Optional path to humidity data raster'
                },
                season: {
                  type: 'string',
                  enum: ['summer', 'winter', 'spring', 'fall'],
                  description: 'Season for microclimate analysis'
                },
                time_of_day: {
                  type: 'string',
                  enum: ['morning', 'afternoon', 'evening', 'night'],
                  description: 'Time of day for analysis'
                },
                output_format: {
                  type: 'string',
                  enum: ['geotiff', 'gpkg', 'png'],
                  description: 'Format for the output'
                }
              },
              required: ['dem_path', 'output_path']
            }
          },
          {
            name: 'qgis:wind_patterns_analysis',
            description: 'Analyze wind patterns and exposure based on terrain features',
            inputSchema: {
              type: 'object',
              properties: {
                dem_path: {
                  type: 'string',
                  description: 'Path to the DEM file'
                },
                output_path: {
                  type: 'string',
                  description: 'Path to save the output files'
                },
                wind_direction: {
                  type: 'number',
                  description: 'Predominant wind direction in degrees (0-360, 0=N, 90=E, 180=S, 270=W)'
                },
                wind_speed: {
                  type: 'number',
                  description: 'Reference wind speed in m/s'
                },
                land_cover_path: {
                  type: 'string',
                  description: 'Optional path to land cover raster'
                },
                season: {
                  type: 'string',
                  enum: ['winter', 'summer', 'spring', 'fall', 'annual'],
                  description: 'Season for wind analysis'
                },
                output_format: {
                  type: 'string',
                  enum: ['geotiff', 'gpkg', 'png'],
                  description: 'Format for the output'
                }
              },
              required: ['dem_path', 'output_path']
            }
          },
          {
            name: 'qgis:habitat_connectivity_analysis',
            description: 'Analyze habitat connectivity and wildlife corridors across the landscape',
            inputSchema: {
              type: 'object',
              properties: {
                dem_path: {
                  type: 'string',
                  description: 'Path to the DEM file'
                },
                output_path: {
                  type: 'string',
                  description: 'Path to save the output files'
                },
                land_cover_path: {
                  type: 'string',
                  description: 'Optional path to land cover raster'
                },
                habitat_areas_path: {
                  type: 'string',
                  description: 'Optional path to habitat areas vector file'
                },
                target_species: {
                  type: 'string',
                  description: 'Target species for connectivity analysis'
                },
                max_cost_distance: {
                  type: 'number',
                  description: 'Maximum cost distance for corridor calculation'
                },
                corridor_width: {
                  type: 'number',
                  description: 'Minimum corridor width in meters'
                },
                output_format: {
                  type: 'string',
                  enum: ['geotiff', 'gpkg', 'png'],
                  description: 'Format for the output'
                }
              },
              required: ['dem_path', 'output_path']
            }
          },
          {
            name: 'qgis:sun_exposure_analysis',
            description: 'Analyze sun exposure patterns across the landscape',
            inputSchema: {
              type: 'object',
              properties: {
                dem_path: {
                  type: 'string',
                  description: 'Path to the DEM file'
                },
                output_path: {
                  type: 'string',
                  description: 'Path to save the output files'
                },
                latitude: {
                  type: 'number',
                  description: 'Site latitude in decimal degrees'
                },
                longitude: {
                  type: 'number',
                  description: 'Site longitude in decimal degrees'
                },
                seasons: {
                  type: 'string',
                  description: 'Comma-separated list of seasons to analyze (summer,winter,spring,fall)'
                },
                day_hours: {
                  type: 'string',
                  description: 'Time range for analysis (e.g., "8-16" for 8am to 4pm)'
                },
                sky_model: {
                  type: 'string',
                  enum: ['clear_sky', 'uniform', 'standard_overcast'],
                  description: 'Sky model to use for sun exposure calculation'
                },
                output_format: {
                  type: 'string',
                  enum: ['geotiff', 'gpkg', 'png'],
                  description: 'Format for the output'
                }
              },
              required: ['dem_path', 'output_path']
            }
          },
          {
            name: 'qgis:biodiversity_potential_analysis',
            description: 'Analyze biodiversity potential across the landscape',
            inputSchema: {
              type: 'object',
              properties: {
                dem_path: {
                  type: 'string',
                  description: 'Path to the DEM file'
                },
                output_path: {
                  type: 'string',
                  description: 'Path to save the output files'
                },
                land_cover_path: {
                  type: 'string',
                  description: 'Optional path to land cover raster'
                },
                distance_to_water: {
                  type: 'boolean',
                  description: 'Whether to include distance to water in the analysis'
                },
                edge_density: {
                  type: 'boolean',
                  description: 'Whether to include edge density in the analysis'
                },
                elevation_range: {
                  type: 'boolean',
                  description: 'Whether to include elevation range in the analysis'
                },
                habitat_diversity_weight: {
                  type: 'number',
                  description: 'Weight factor for habitat diversity (0-1)'
                },
                connectivity_weight: {
                  type: 'number',
                  description: 'Weight factor for connectivity (0-1)'
                },
                elevation_weight: {
                  type: 'number',
                  description: 'Weight factor for elevation diversity (0-1)'
                },
                water_weight: {
                  type: 'number',
                  description: 'Weight factor for proximity to water (0-1)'
                },
                output_format: {
                  type: 'string',
                  enum: ['geotiff', 'gpkg', 'png'],
                  description: 'Format for the output'
                }
              },
              required: ['dem_path', 'output_path']
            }
          }
          // Add more tools here as they are implemented
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!this.qgisAvailable) {
        throw new McpError(
          ErrorCode.InternalError,
          'QGIS environment is not available'
        );
      }

      const { name, arguments: args } = request.params;

      logger.info(`Tool call: ${name}`, { arguments: args });

      try {
        switch (name) {
          case 'qgis:slope_analysis':
            // Validate or cast args to SlopeAnalysisParams before calling slopeAnalysis
            const slopeArgs: SlopeAnalysisParams = args as SlopeAnalysisParams;
            const slopeResult = await slopeAnalysis(slopeArgs);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(slopeResult, null, 2)
                }
              ]
            };
          
          case 'qgis:watershed_analysis':
            // Validate or cast args to WatershedAnalysisParams
            const watershedArgs: WatershedAnalysisParams = args as WatershedAnalysisParams;
            const watershedResult = await watershedAnalysis(watershedArgs);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(watershedResult, null, 2)
                }
              ]
            };
            
          case 'qgis:aspect_analysis':
            // Validate or cast args to AspectAnalysisParams
            const aspectArgs: AspectAnalysisParams = args as AspectAnalysisParams;
            const aspectResult = await aspectAnalysis(aspectArgs);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(aspectResult, null, 2)
                }
              ]
            };
            
          case 'qgis:viewshed_analysis':
            // Validate or cast args to ViewshedAnalysisParams
            const viewshedArgs: ViewshedAnalysisParams = args as ViewshedAnalysisParams;
            const viewshedResult = await viewshedAnalysis(viewshedArgs);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(viewshedResult, null, 2)
                }
              ]
            };
          
          case 'qgis:temperature_gradients_analysis':
            // Validate or cast args to TemperatureGradientsParams
            const temperatureArgs = this.mapMcpParamsToOperation(args, 'temperature_gradients');
            const temperatureResult = await executeTemperatureGradientsAnalysis(temperatureArgs);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(temperatureResult, null, 2)
                }
              ]
            };
          
          case 'qgis:drainage_pattern_analysis':
            // Validate or cast args to DrainagePatternParams
            const drainageArgs = this.mapMcpParamsToOperation(args, 'drainage_pattern');
            const drainageResult = await executeDrainagePatternAnalysis(drainageArgs);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(drainageResult, null, 2)
                }
              ]
            };
          
          case 'qgis:microclimate_analysis':
            // Validate or cast args to MicroclimateParams
            const microclimateArgs = this.mapMcpParamsToOperation(args, 'microclimate');
            const microclimateResult = await executeMicroclimateAnalysis(microclimateArgs);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(microclimateResult, null, 2)
                }
              ]
            };
          
          case 'qgis:wind_patterns_analysis':
            // Validate or cast args to WindPatternsParams
            const windPatternsArgs = this.mapMcpParamsToOperation(args, 'wind_patterns');
            const windPatternsResult = await executeWindPatternsAnalysis(windPatternsArgs);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(windPatternsResult, null, 2)
                }
              ]
            };
          
          case 'qgis:habitat_connectivity_analysis':
            // Validate or cast args to HabitatConnectivityParams
            const habitatArgs = this.mapMcpParamsToOperation(args, 'habitat_connectivity');
            const habitatResult = await executeHabitatConnectivityAnalysis(habitatArgs);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(habitatResult, null, 2)
                }
              ]
            };
          
          case 'qgis:sun_exposure_analysis':
            // Validate or cast args to SunExposureParams
            const sunExposureArgs = this.mapMcpParamsToOperation(args, 'sun_exposure');
            const sunExposureResult = await executeSunExposureAnalysis(sunExposureArgs);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(sunExposureResult, null, 2)
                }
              ]
            };
          
          case 'qgis:biodiversity_potential_analysis':
            // Validate or cast args to BiodiversityPotentialParams
            const biodiversityArgs = this.mapMcpParamsToOperation(args, 'biodiversity_potential');
            const biodiversityResult = await executeBiodiversityPotentialAnalysis(biodiversityArgs);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(biodiversityResult, null, 2)
                }
              ]
            };
            
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Tool not found: ${name}`
            );
        }
      } catch (error) {
        logger.error(`Error executing tool ${name}`, { error });
        
        if (error instanceof McpError) {
          throw error;
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `Error executing tool ${name}: ${(error as Error).message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  // Map MCP request parameters to operation-specific parameters
  private mapMcpParamsToOperation(args: any, type: string): any {
    // Basic parameter structure
    const params: any = {
      type,
      projectId: args.project_id || 'default',
      jobId: args.job_id,
    };

    // Map standard parameters
    if (args.dem_path) params.demPath = args.dem_path;
    if (args.output_path) params.outputPath = args.output_path;
    
    // Add analysis-specific parameters
    switch (type) {
      case 'temperature_gradients':
        if (args.land_cover_path) params.landCoverPath = args.land_cover_path;
        if (args.season) params.season = args.season;
        if (args.time_of_day) params.timeOfDay = args.time_of_day;
        if (args.latitude) params.latitude = args.latitude;
        if (args.humidity_data) params.humidityData = args.humidity_data;
        if (args.wind_data) params.windData = args.wind_data;
        break;
      
      case 'drainage_pattern':
        if (args.flow_accumulation_threshold) params.flowAccumulationThreshold = args.flow_accumulation_threshold;
        if (args.stream_order_method) params.streamOrderMethod = args.stream_order_method;
        if (args.include_catchments) params.includeCatchments = args.include_catchments;
        if (args.fill_sinks !== undefined) params.fillSinks = args.fill_sinks;
        break;
        
      case 'microclimate':
        if (args.land_cover_path) params.landCoverPath = args.land_cover_path;
        if (args.wind_data_path) params.windDataPath = args.wind_data_path;
        if (args.humidity_data_path) params.humidityDataPath = args.humidity_data_path;
        if (args.season) params.season = args.season;
        if (args.time_of_day) params.timeOfDay = args.time_of_day;
        break;
        
      case 'wind_patterns':
        if (args.wind_direction) params.windDirection = args.wind_direction;
        if (args.wind_speed) params.windSpeed = args.wind_speed;
        if (args.land_cover_path) params.landCoverPath = args.land_cover_path;
        if (args.season) params.season = args.season;
        break;
        
      case 'habitat_connectivity':
        if (args.land_cover_path) params.landCoverPath = args.land_cover_path;
        if (args.habitat_areas_path) params.habitatAreasPath = args.habitat_areas_path;
        if (args.target_species) params.targetSpecies = args.target_species;
        if (args.max_cost_distance) params.maxCostDistance = args.max_cost_distance;
        if (args.corridor_width) params.corridorWidth = args.corridor_width;
        break;
        
      case 'sun_exposure':
        if (args.latitude) params.latitude = args.latitude;
        if (args.longitude) params.longitude = args.longitude;
        if (args.seasons) params.seasons = args.seasons;
        if (args.day_hours) params.dayHours = args.day_hours;
        if (args.sky_model) params.skyModel = args.sky_model;
        break;
        
      case 'biodiversity_potential':
        if (args.land_cover_path) params.landCoverPath = args.land_cover_path;
        if (args.distance_to_water !== undefined) params.distanceToWater = args.distance_to_water;
        if (args.edge_density !== undefined) params.edgeDensity = args.edge_density;
        if (args.elevation_range !== undefined) params.elevationRange = args.elevation_range;
        if (args.habitat_diversity_weight) params.habitatDiversityWeight = args.habitat_diversity_weight;
        if (args.connectivity_weight) params.connectivityWeight = args.connectivity_weight;
        if (args.elevation_weight) params.elevationWeight = args.elevation_weight;
        if (args.water_weight) params.waterWeight = args.water_weight;
        break;
    }

    return params;
  }

  async start() {
    try {
      // Check QGIS environment
      this.qgisAvailable = await checkQGISEnvironment();
      if (!this.qgisAvailable) {
        logger.warn('QGIS environment is not available, server will respond with errors');
      }

      // Connect to transport
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      logger.info('QGIS MCP server started');
    } catch (error) {
      logger.error('Failed to start server', { error });
      process.exit(1);
    }
  }
}

// Start the server
const server = new QGISMCPServer();
server.start().catch(error => {
  logger.error('Unhandled error during server startup', { error });
  process.exit(1);
});
