/**
 * Tests for MCP server functionality
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// Mock the SDK components
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => {
  return {
    Server: vi.fn().mockImplementation(() => ({
      onerror: null,
      setRequestHandler: vi.fn(),
      connect: vi.fn(),
      close: vi.fn()
    }))
  };
});

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  return {
    StdioServerTransport: vi.fn().mockImplementation(() => ({}))
  };
});

// Create a simplified version of server.js for testing
class TestQGISMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'qgis-mcp-server-test',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.qgisAvailable = true;
    this.setupHandlers();
  }
  
  setupHandlers() {
    this.server.setRequestHandler('list_tools', async () => {
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
            description: 'Calculate slope values from a DEM'
          },
          {
            name: 'qgis:watershed_analysis',
            description: 'Analyze watersheds and stream networks from a DEM'
          },
          {
            name: 'qgis:aspect_analysis',
            description: 'Calculate aspect (slope direction) from a DEM'
          },
          {
            name: 'qgis:viewshed_analysis',
            description: 'Calculate visible areas from observer points'
          }
        ]
      };
    });
    
    this.server.setRequestHandler('call_tool', async (request) => {
      if (!this.qgisAvailable) {
        throw new McpError(
          ErrorCode.InternalError,
          'QGIS environment is not available'
        );
      }
      
      // For testing, just echo back the request
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(request.params, null, 2)
          }
        ]
      };
    });
  }
  
  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    return true;
  }
  
  async close() {
    await this.server.close();
  }
}

describe('QGIS MCP Server', () => {
  let server;
  
  beforeEach(() => {
    server = new TestQGISMCPServer();
  });
  
  afterEach(async () => {
    await server.close();
  });
  
  it('should initialize server with correct configuration', () => {
    expect(Server).toHaveBeenCalledWith(
      {
        name: 'qgis-mcp-server-test',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
  });
  
  it('should set up request handlers', () => {
    expect(server.server.setRequestHandler).toHaveBeenCalledTimes(2);
    expect(server.server.setRequestHandler).toHaveBeenCalledWith('list_tools', expect.any(Function));
    expect(server.server.setRequestHandler).toHaveBeenCalledWith('call_tool', expect.any(Function));
  });
  
  it('should connect to transport when started', async () => {
    await server.start();
    
    expect(StdioServerTransport).toHaveBeenCalledTimes(1);
    expect(server.server.connect).toHaveBeenCalledTimes(1);
    expect(server.server.connect).toHaveBeenCalledWith(expect.any(Object));
  });
  
  it('should throw error when QGIS is unavailable', async () => {
    server.qgisAvailable = false;
    
    try {
      await server.server.setRequestHandler.mock.calls[0][1]();
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(McpError);
      expect(error.code).toBe(ErrorCode.InternalError);
    }
  });
}); 