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
import { SlopeAnalysisParams } from './types/terrain_analysis.js';

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
            const validatedArgs: SlopeAnalysisParams = args as SlopeAnalysisParams;
            const result = await slopeAnalysis(validatedArgs);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
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
