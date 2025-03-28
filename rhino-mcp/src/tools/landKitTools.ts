/**
 * Land Kit Pro Tools for MCP
 * 
 * This file implements the MCP tools that leverage Land Kit Pro, a professional
 * landscape architecture toolkit for Rhino.
 */

import { LandKitIntegration } from '../integrations/landKitIntegration.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Land Kit integration
const landKitConfig = {
  apiUrl: process.env.LAND_KIT_API_URL || 'http://localhost:9000',
  apiKey: process.env.LAND_KIT_API_KEY || '',
  timeout: parseInt(process.env.LAND_KIT_TIMEOUT || '30000', 10)
};

const landKit = new LandKitIntegration(landKitConfig);

// Tool implementation for contour generation
export const contourGenerationTool = {
  name: 'landkit_generate_contours',
  description: 'Generate contours from a digital elevation model using Land Kit Pro',
  inputSchema: {
    type: 'object',
    properties: {
      dem_path: {
        type: 'string',
        description: 'Path to the DEM file'
      },
      interval: {
        type: 'number',
        description: 'Contour interval in the DEM\'s units'
      },
      smoothing: {
        type: 'number',
        description: 'Smoothing factor for contours (0 = no smoothing, higher values = more smoothing)'
      },
      parameters: {
        type: 'object',
        description: 'Additional parameters for contour generation'
      }
    },
    required: ['dem_path', 'interval']
  },
  handler: async (args: any) => {
    try {
      const result = await landKit.generateContours(
        args.dem_path,
        args.interval,
        args.smoothing || 0,
        args.parameters || {}
      );
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error generating contours: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
};

// Tool implementation for terrain profile generation
export const profileGenerationTool = {
  name: 'landkit_create_profiles',
  description: 'Create terrain profiles along specified lines using Land Kit Pro',
  inputSchema: {
    type: 'object',
    properties: {
      dem_path: {
        type: 'string',
        description: 'Path to the DEM file'
      },
      profile_lines: {
        type: 'array',
        items: {
          type: 'object',
          description: 'Profile line geometry'
        },
        description: 'Array of line geometries along which to create profiles'
      },
      sample_distance: {
        type: 'number',
        description: 'Distance between sample points along the profile'
      },
      parameters: {
        type: 'object',
        description: 'Additional parameters for profile generation'
      }
    },
    required: ['dem_path', 'profile_lines']
  },
  handler: async (args: any) => {
    try {
      const result = await landKit.createProfiles(
        args.dem_path,
        args.profile_lines,
        args.sample_distance || 1.0,
        args.parameters || {}
      );
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error creating profiles: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
};

// Tool implementation for cut and fill calculation
export const cutFillCalculationTool = {
  name: 'landkit_calculate_cut_fill',
  description: 'Calculate cut and fill volumes between existing and proposed surfaces using Land Kit Pro',
  inputSchema: {
    type: 'object',
    properties: {
      existing_dem: {
        type: 'string',
        description: 'Path to the existing condition DEM file'
      },
      proposed_dem: {
        type: 'string',
        description: 'Path to the proposed condition DEM file'
      },
      boundary_polygon: {
        type: 'object',
        description: 'Optional boundary polygon to limit the calculation'
      },
      parameters: {
        type: 'object',
        description: 'Additional parameters for cut/fill calculation'
      }
    },
    required: ['existing_dem', 'proposed_dem']
  },
  handler: async (args: any) => {
    try {
      const result = await landKit.calculateCutFill(
        args.existing_dem,
        args.proposed_dem,
        args.boundary_polygon,
        args.parameters || {}
      );
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error calculating cut and fill: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
};

// Tool implementation for watershed analysis
export const watershedAnalysisTool = {
  name: 'landkit_analyze_watersheds',
  description: 'Analyze watersheds for specified pour points using Land Kit Pro',
  inputSchema: {
    type: 'object',
    properties: {
      dem_path: {
        type: 'string',
        description: 'Path to the DEM file'
      },
      pour_points: {
        type: 'array',
        items: {
          type: 'object',
          description: 'Pour point geometry'
        },
        description: 'Array of pour point locations for watershed delineation'
      },
      parameters: {
        type: 'object',
        description: 'Additional parameters for watershed analysis'
      }
    },
    required: ['dem_path', 'pour_points']
  },
  handler: async (args: any) => {
    try {
      const result = await landKit.analyzeWatersheds(
        args.dem_path,
        args.pour_points,
        args.parameters || {}
      );
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error analyzing watersheds: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
};

// Tool implementation for flow path generation
export const flowPathGenerationTool = {
  name: 'landkit_generate_flow_paths',
  description: 'Generate water flow paths from specified start points using Land Kit Pro',
  inputSchema: {
    type: 'object',
    properties: {
      dem_path: {
        type: 'string',
        description: 'Path to the DEM file'
      },
      start_points: {
        type: 'array',
        items: {
          type: 'object',
          description: 'Start point geometry'
        },
        description: 'Array of start point locations for flow path generation'
      },
      max_distance: {
        type: 'number',
        description: 'Maximum flow path distance'
      },
      parameters: {
        type: 'object',
        description: 'Additional parameters for flow path generation'
      }
    },
    required: ['dem_path', 'start_points']
  },
  handler: async (args: any) => {
    try {
      const result = await landKit.generateFlowPaths(
        args.dem_path,
        args.start_points,
        args.max_distance || 1000,
        args.parameters || {}
      );
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error generating flow paths: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
};

// Tool implementation for viewshed analysis
export const viewshedAnalysisTool = {
  name: 'landkit_analyze_viewshed',
  description: 'Perform viewshed analysis from a viewer point using Land Kit Pro',
  inputSchema: {
    type: 'object',
    properties: {
      dem_path: {
        type: 'string',
        description: 'Path to the DEM file'
      },
      viewer_point: {
        type: 'object',
        description: 'Viewer point geometry'
      },
      radius: {
        type: 'number',
        description: 'Analysis radius in map units'
      },
      viewer_height: {
        type: 'number',
        description: 'Height of the viewer in map units'
      },
      parameters: {
        type: 'object',
        description: 'Additional parameters for viewshed analysis'
      }
    },
    required: ['dem_path', 'viewer_point', 'radius']
  },
  handler: async (args: any) => {
    try {
      const result = await landKit.analyzeViewshed(
        args.dem_path,
        args.viewer_point,
        args.radius,
        args.viewer_height || 1.7,
        args.parameters || {}
      );
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error analyzing viewshed: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
};

// Tool implementation for solar analysis
export const solarAnalysisTool = {
  name: 'landkit_analyze_solar',
  description: 'Perform solar radiation analysis using Land Kit Pro',
  inputSchema: {
    type: 'object',
    properties: {
      dem_path: {
        type: 'string',
        description: 'Path to the DEM file'
      },
      date: {
        type: 'string',
        description: 'Analysis date in YYYY-MM-DD format'
      },
      time_range: {
        type: 'array',
        items: {
          type: 'string'
        },
        description: 'Start and end times in HH:MM format'
      },
      interval: {
        type: 'number',
        description: 'Time interval in minutes'
      },
      parameters: {
        type: 'object',
        description: 'Additional parameters for solar analysis'
      }
    },
    required: ['dem_path', 'date', 'time_range']
  },
  handler: async (args: any) => {
    try {
      const result = await landKit.analyzeSolar(
        args.dem_path,
        args.date,
        args.time_range,
        args.interval || 60,
        args.parameters || {}
      );
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error analyzing solar radiation: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
};

// Tool implementation for vegetation application
export const vegetationApplicationTool = {
  name: 'landkit_apply_vegetation',
  description: 'Apply vegetation to a site using Land Kit Pro',
  inputSchema: {
    type: 'object',
    properties: {
      site_boundary: {
        type: 'object',
        description: 'Site boundary geometry'
      },
      vegetation_plan: {
        type: 'object',
        description: 'Vegetation plan specification'
      },
      parameters: {
        type: 'object',
        description: 'Additional parameters for vegetation application'
      }
    },
    required: ['site_boundary', 'vegetation_plan']
  },
  handler: async (args: any) => {
    try {
      const result = await landKit.applyVegetation(
        args.site_boundary,
        args.vegetation_plan,
        args.parameters || {}
      );
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error applying vegetation: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
};

// Export all tools
export const landKitTools = [
  contourGenerationTool,
  profileGenerationTool,
  cutFillCalculationTool,
  watershedAnalysisTool,
  flowPathGenerationTool,
  viewshedAnalysisTool,
  solarAnalysisTool,
  vegetationApplicationTool
];
