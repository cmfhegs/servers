/**
 * McHarg Analysis Tools for MCP
 * 
 * This file implements the MCP tools for McHarg's layer-based site analysis methodology.
 * It focuses on the priority layers identified in the requirements.
 */

import { McHargLayerAnalysisService } from '../services/mcHargLayerAnalysis.js';
import { SensorDataManager } from '../services/sensorDataManager.js';

// Tool implementation for terrain analysis
export const terrainAnalysisTool = {
  name: 'mcHarg_terrain_analysis',
  description: 'Analyze terrain using McHarg\'s layer-based methodology',
  inputSchema: {
    type: 'object',
    properties: {
      dem: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL or path to the DEM file' },
          format: { type: 'string', description: 'Format of the DEM file (e.g., "GeoTIFF")' }
        },
        required: ['url'],
        description: 'Digital Elevation Model data'
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
        properties: {
          resolution: { type: 'string', description: 'Analysis resolution (e.g., "10m")' },
          verticalDatum: { type: 'string', description: 'Vertical datum (e.g., "NAVD88")' },
          horizontalDatum: { type: 'string', description: 'Horizontal datum (e.g., "WGS84")' }
        },
        description: 'Additional parameters for analysis'
      }
    },
    required: ['dem', 'analysis_types']
  },
  handler: async (args: any) => {
    const analysisService = new McHargLayerAnalysisService();
    
    try {
      const result = await analysisService.analyzePhysiography(
        args.dem,
        args.analysis_types,
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
            text: `Error analyzing terrain: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
};

// Tool implementation for hydrology analysis
export const hydrologyAnalysisTool = {
  name: 'mcHarg_hydrology_analysis',
  description: 'Analyze hydrology using McHarg\'s layer-based methodology',
  inputSchema: {
    type: 'object',
    properties: {
      dem: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL or path to the DEM file' },
          format: { type: 'string', description: 'Format of the DEM file (e.g., "GeoTIFF")' }
        },
        required: ['url'],
        description: 'Digital Elevation Model data'
      },
      water_bodies: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL or path to water bodies data' },
          format: { type: 'string', description: 'Format of the data (e.g., "GeoJSON")' }
        },
        description: 'Optional water bodies data'
      },
      flood_zones: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL or path to flood zone data' },
          format: { type: 'string', description: 'Format of the data (e.g., "GeoJSON")' }
        },
        description: 'Optional flood zone data'
      },
      parameters: {
        type: 'object',
        properties: {
          resolution: { type: 'string', description: 'Analysis resolution (e.g., "10m")' },
          accuracy: { type: 'string', description: 'Data accuracy level' },
          seasonality: { type: 'string', description: 'Seasonality of the data' }
        },
        description: 'Additional parameters for analysis'
      }
    },
    required: ['dem']
  },
  handler: async (args: any) => {
    const analysisService = new McHargLayerAnalysisService();
    
    try {
      const optionalData: any = {};
      
      if (args.water_bodies) {
        optionalData.waterBodies = args.water_bodies;
      }
      
      if (args.flood_zones) {
        optionalData.floodZones = args.flood_zones;
      }
      
      const result = await analysisService.analyzeHydrology(
        args.dem,
        optionalData,
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
            text: `Error analyzing hydrology: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
};

// Tool implementation for soils analysis
export const soilsAnalysisTool = {
  name: 'mcHarg_soils_analysis',
  description: 'Analyze soils using McHarg\'s layer-based methodology',
  inputSchema: {
    type: 'object',
    properties: {
      soils_data: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL or path to soils data' },
          format: { type: 'string', description: 'Format of the data (e.g., "GeoJSON")' },
          features: {
            type: 'array',
            items: {
              type: 'object'
            },
            description: 'Optional soil features if not loading from URL'
          }
        },
        required: ['url'],
        description: 'Soils data'
      },
      parameters: {
        type: 'object',
        properties: {
          surveyDate: { type: 'string', description: 'Date of soil survey' },
          soilClassificationSystem: { type: 'string', description: 'Soil classification system (e.g., "USDA")' }
        },
        description: 'Additional parameters for analysis'
      }
    },
    required: ['soils_data']
  },
  handler: async (args: any) => {
    const analysisService = new McHargLayerAnalysisService();
    
    try {
      const result = await analysisService.analyzeSoils(
        args.soils_data,
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
            text: `Error analyzing soils: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
};

// Tool implementation for suitability analysis
export const suitabilityAnalysisTool = {
  name: 'mcHarg_suitability_analysis',
  description: 'Perform suitability analysis using McHarg\'s overlay methodology',
  inputSchema: {
    type: 'object',
    properties: {
      layers: {
        type: 'array',
        items: {
          type: 'object'
        },
        description: 'Layer data for analysis'
      },
      criteria: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            layerId: { type: 'string', description: 'ID of the layer' },
            weight: { type: 'number', description: 'Weight of the layer in analysis (0-1)' },
            suitabilityCriteria: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', description: 'Field to evaluate' },
                  operator: { type: 'string', description: 'Comparison operator (e.g., ">", "<", "=")' },
                  value: { type: 'any', description: 'Value to compare against' },
                  suitabilityScore: { type: 'number', description: 'Suitability score (1-5)' }
                }
              },
              description: 'Criteria for evaluating suitability'
            }
          },
          required: ['layerId', 'weight', 'suitabilityCriteria']
        },
        description: 'Analysis criteria'
      },
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the analysis' },
          description: { type: 'string', description: 'Description of the analysis' }
        },
        description: 'Additional parameters for analysis'
      }
    },
    required: ['layers', 'criteria']
  },
  handler: async (args: any) => {
    const analysisService = new McHargLayerAnalysisService();
    
    try {
      const result = await analysisService.performSuitabilityAnalysis(
        args.layers,
        args.criteria,
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
            text: `Error performing suitability analysis: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
};

// Tool implementation for sensor registration
export const registerSensorTool = {
  name: 'register_sensor',
  description: 'Register a new sensor for environmental monitoring',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Unique identifier for the sensor'
      },
      type: {
        type: 'string',
        enum: [
          'temperature', 'humidity', 'soil_moisture', 'light',
          'water_level', 'air_quality', 'wind', 'precipitation',
          'sound', 'motion'
        ],
        description: 'Type of sensor'
      },
      location: {
        type: 'object',
        properties: {
          x: { type: 'number', description: 'X coordinate' },
          y: { type: 'number', description: 'Y coordinate' },
          z: { type: 'number', description: 'Z coordinate' },
          accuracy: { type: 'number', description: 'Location accuracy in meters' }
        },
        required: ['x', 'y', 'z'],
        description: 'Sensor location'
      },
      installationDate: {
        type: 'string',
        description: 'Date when the sensor was installed (ISO format)'
      },
      measurementUnits: {
        type: 'string',
        description: 'Units of measurement for the sensor'
      },
      manufacturer: {
        type: 'string',
        description: 'Sensor manufacturer'
      },
      model: {
        type: 'string',
        description: 'Sensor model'
      }
    },
    required: ['id', 'type', 'location', 'measurementUnits']
  },
  handler: async (args: any) => {
    const sensorManager = new SensorDataManager();
    
    try {
      const sensorId = sensorManager.registerSensor({
        id: args.id,
        type: args.type,
        location: args.location,
        installationDate: args.installationDate || new Date().toISOString(),
        measurementUnits: args.measurementUnits,
        manufacturer: args.manufacturer,
        model: args.model
      });
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              sensorId,
              message: `Sensor ${args.id} of type ${args.type} registered successfully`
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error registering sensor: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
};

// Tool implementation for sensor data ingestion
export const ingestSensorDataTool = {
  name: 'ingest_sensor_data',
  description: 'Ingest data readings from sensors',
  inputSchema: {
    type: 'object',
    properties: {
      readings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            sensorId: { type: 'string', description: 'ID of the sensor' },
            timestamp: { type: 'string', description: 'Timestamp of the reading (ISO format)' },
            value: { type: 'any', description: 'Value of the reading' },
            quality: { type: 'number', description: 'Quality indicator (0-1)' }
          },
          required: ['sensorId', 'timestamp', 'value']
        },
        description: 'Sensor readings to ingest'
      }
    },
    required: ['readings']
  },
  handler: async (args: any) => {
    const sensorManager = new SensorDataManager();
    
    try {
      const result = await sensorManager.ingestData(args.readings);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              processedCount: result.processedCount,
              errors: result.errors.length,
              message: `Processed ${result.processedCount} readings with ${result.errors.length} errors`
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error ingesting sensor data: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
};

// Export all tools
export const mcHargTools = [
  terrainAnalysisTool,
  hydrologyAnalysisTool,
  soilsAnalysisTool,
  suitabilityAnalysisTool,
  registerSensorTool,
  ingestSensorDataTool
];
