#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import dotenv from 'dotenv';

// Import tools
import { mcHargTools } from './tools/mcHargTools.js';
import { landKitTools } from './tools/landKitTools.js';

// Load environment variables
dotenv.config();

// Rhino.compute API endpoint
const RHINO_COMPUTE_URL = process.env.RHINO_COMPUTE_URL || 'http://localhost:8081/';

class RhinoComputeMcpServer {
  private server: Server;
  private axiosInstance;

  constructor() {
    // Server setup
    this.server = new Server(
      {
        name: 'rhino-compute-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // HTTP client for Rhino.compute
    this.axiosInstance = axios.create({
      baseURL: RHINO_COMPUTE_URL,
    });

    // Set up tools
    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      // Combine legacy tools with McHarg tools
      const legacyTools = [
        {
          name: 'terrain_analysis',
          description: 'Analyze terrain for slope, aspect, and landform classification using Rhino.compute',
          inputSchema: {
            type: 'object',
            properties: {
              dem: { 
                type: 'string',
                description: 'Path or URL to digital elevation model'
              },
              analysis_types: { 
                type: 'array', 
                items: { 
                  type: 'string',
                  enum: ['slope', 'aspect', 'curvature', 'landform_classification']
                },
                description: 'Types of analysis to perform'
              },
              parameters: {
                type: 'object',
                description: 'Additional parameters for the analysis'
              }
            },
            required: ['dem', 'analysis_types']
          }
        }
      ];
      
      return {
        tools: [...legacyTools, ...mcHargTools, ...landKitTools]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        // Handle legacy tools
        if (request.params.name === 'terrain_analysis') {
          return await this.handleTerrainAnalysis(request.params.arguments);
        }
        
        // Handle McHarg tools
        const mcHargTool = mcHargTools.find(tool => tool.name === request.params.name);
        if (mcHargTool) {
          return await mcHargTool.handler(request.params.arguments);
        }
        
        // Handle Land Kit tools
        const landKitTool = landKitTools.find(tool => tool.name === request.params.name);
        if (landKitTool) {
          return await landKitTool.handler(request.params.arguments);
        }
        
        // Unknown tool
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      } catch (error) {
        // Handle axios errors
        if (axios.isAxiosError(error)) {
          return {
            content: [
              {
                type: 'text',
                text: `Rhino.compute API error: ${error.response?.data || error.message}`
              }
            ],
            isError: true
          };
        }
        
        // Re-throw other errors
        throw error;
      }
    });
  }

  // Legacy tool implementation handler
  private async handleTerrainAnalysis(args: any) {
    console.error('Legacy terrain analysis request:', args);
    
    // For initial implementation, we'll mock the response
    // In a real implementation, this would call Rhino.compute

    // Define the response structure
    interface TerrainAnalysisResponse {
      status: string;
      dem: string;
      results: {
        slope?: {
          min: number;
          max: number;
          mean: number;
          classification: Record<string, number>;
        };
        aspect?: {
          north: number;
          northeast: number;
          east: number;
          southeast: number;
          south: number;
          southwest: number;
          west: number;
          northwest: number;
        };
        [key: string]: any;
      };
    }

    // Example mock response
    const mockResponse: TerrainAnalysisResponse = {
      status: 'success',
      dem: args.dem,
      results: {}
    };

    // Generate mock results for each requested analysis type
    if (args.analysis_types.includes('slope')) {
      mockResponse.results.slope = {
        min: 0,
        max: 45,
        mean: 12.5,
        classification: {
          '0-5%': 30,
          '5-10%': 25,
          '10-15%': 20,
          '15-25%': 15,
          '>25%': 10
        }
      };
    }

    if (args.analysis_types.includes('aspect')) {
      mockResponse.results.aspect = {
        north: 20,
        northeast: 15,
        east: 10,
        southeast: 5,
        south: 15,
        southwest: 10,
        west: 15,
        northwest: 10
      };
    }

    // In the future, this will call the actual Rhino.compute API
    // const response = await this.axiosInstance.post('/terrain/analyze', {
    //   dem: args.dem,
    //   analysisTypes: args.analysis_types,
    //   parameters: args.parameters || {}
    // });
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(mockResponse, null, 2)
        }
      ]
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Rhino.compute MCP server running on stdio');
    // Don't use console.log, it can interfere with the MCP communication
    console.error('Available tools:', 
      [...mcHargTools, ...landKitTools].map(tool => tool.name).join(', ')
    );
    
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }
}

// Create and run the server
const server = new RhinoComputeMcpServer();
server.run().catch(console.error);
