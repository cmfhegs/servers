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
import { SlopeAnalysisParams } from './types/terrain_analysis.js';
import { WatershedAnalysisParams } from './types/watershed_analysis.js';
import { AspectAnalysisParams } from './types/aspect_analysis.js';
import { ViewshedAnalysisParams } from './types/viewshed_analysis.js';

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
