/**
 * QGIS Service Connector
 * 
 * This module provides a client for communicating with the QGIS Docker container's
 * HTTP API. It handles requests to perform terrain analysis operations.
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import fs from 'fs';
import path from 'path';
import winston from 'winston';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

// Connector options interface
interface QGISConnectorOptions {
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

// Response interface
interface QGISResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

// Algorithm interface
interface QGISAlgorithm {
  id: string;
  name: string;
  group: string;
  description: string;
  parameters: Record<string, any>;
}

// Analysis Parameters interfaces
interface BaseAnalysisParams {
  dem_path: string;
  output_path: string;
  output_format?: string;
}

interface WatershedAnalysisParams extends BaseAnalysisParams {
  pour_points: Array<[number, number]>;
  snap_distance?: number;
  min_basin_size?: number;
}

interface AspectAnalysisParams extends BaseAnalysisParams {
  categories?: number;
  include_flat?: boolean;
  category_labels?: string[];
}

interface ViewshedAnalysisParams extends BaseAnalysisParams {
  observer_points: Array<{
    x: number;
    y: number;
    height?: number;
  }>;
  radius?: number;
  observer_height?: number;
}

interface SlopeAnalysisParams extends BaseAnalysisParams {
  slope_units?: 'degrees' | 'percent';
  z_factor?: number;
  min_slope?: number;
  max_slope?: number;
  classification?: string;
}

interface ZoningClass {
  id: string;
  name: string;
  allowed_uses: string[];
  restrictions: string[];
  density: number;
  color: string;
}

interface ZoningAnalysisParams extends BaseAnalysisParams {
  zoning_data_path?: string;
  buffer_distance?: number;
  allowed_uses?: string[];
  zoning_classes?: ZoningClass[];
}

interface LandUseAnalysisParams extends BaseAnalysisParams {
  land_use_data_path?: string;
  land_use_database?: string;
  reference_year?: number;
  include_change_analysis?: boolean;
  end_year?: number;
  buffer_distance?: number;
  class_filter?: string[];
}

interface DevelopmentConstraintsAnalysisParams extends BaseAnalysisParams {
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
}

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'qgis-connector' },
  transports: [
    new winston.transports.File({ filename: 'qgis-connector-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'qgis-connector.log' })
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

/**
 * QGIS HTTP API client
 */
export class QGISConnector {
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;
  private axiosInstance: AxiosInstance;
  
  /**
   * Create a new QGIS connector
   * @param options - Connection options
   */
  constructor(options: QGISConnectorOptions = {}) {
    this.baseUrl = options.baseUrl || process.env.QGIS_SERVER_URL || 'http://localhost:5000';
    this.timeout = options.timeout || 120000; // 2 minutes default timeout
    this.maxRetries = options.maxRetries || 3;
    
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    logger.info(`QGIS connector initialized with base URL: ${this.baseUrl}`);
  }
  
  /**
   * Check if the QGIS service is healthy
   * @returns True if the service is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.axiosInstance.get('/health');
      return response.data?.status === 'ok';
    } catch (error) {
      logger.error('Health check failed', { error: (error as Error).message });
      return false;
    }
  }
  
  /**
   * Get a list of available QGIS algorithms
   * @returns List of algorithms
   */
  async getAlgorithms(): Promise<QGISAlgorithm[]> {
    try {
      const response = await this.axiosInstance.get('/algorithms');
      return response.data?.algorithms || [];
    } catch (error) {
      logger.error('Failed to get algorithms', { error: (error as Error).message });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get QGIS algorithms: ${(error as Error).message}`
      );
    }
  }
  
  /**
   * Execute a request with retry logic
   * @param requestFn - Function that returns a Promise
   * @returns Response data
   */
  async executeWithRetry<T>(requestFn: () => Promise<T>): Promise<T> {
    let retries = 0;
    let lastError: Error | McpError | null = null;
    
    while (retries < this.maxRetries) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error as Error;
        retries++;
        
        if (retries >= this.maxRetries) {
          break;
        }
        
        // Exponential backoff
        const delay = Math.pow(2, retries) * 1000;
        logger.warn(`Request failed, retrying in ${delay}ms (${retries}/${this.maxRetries})`, {
          error: (error as Error).message
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    logger.error(`Request failed after ${retries} retries`, {
      error: lastError?.message
    });
    
    if (lastError instanceof McpError) {
      throw lastError;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `QGIS request failed after ${retries} retries: ${lastError?.message}`
    );
  }
  
  /**
   * Perform slope analysis on a DEM
   * @param params - Slope analysis parameters
   * @returns Analysis results
   */
  async performSlopeAnalysis(params: BaseAnalysisParams): Promise<QGISResponse> {
    logger.info('Performing slope analysis', { params });
    
    return this.executeWithRetry(async () => {
      const response = await this.axiosInstance.post('/process/slope_analysis', params);
      
      if (!response.data.success) {
        throw new McpError(
          ErrorCode.InternalError,
          `Slope analysis failed: ${response.data.error?.message || 'Unknown error'}`
        );
      }
      
      return response.data;
    });
  }
  
  /**
   * Perform flow path analysis on a DEM
   * @param params - Flow path analysis parameters
   * @returns Analysis results
   */
  async performFlowPathAnalysis(params: BaseAnalysisParams & { pour_points: Array<[number, number]> }): Promise<QGISResponse> {
    logger.info('Performing flow path analysis', { params });
    
    return this.executeWithRetry(async () => {
      const response = await this.axiosInstance.post('/process/flow_path_analysis', params);
      
      if (!response.data.success) {
        throw new McpError(
          ErrorCode.InternalError,
          `Flow path analysis failed: ${response.data.error?.message || 'Unknown error'}`
        );
      }
      
      return response.data;
    });
  }
  
  /**
   * Run a generic QGIS algorithm
   * @param algorithm - Algorithm identifier
   * @param parameters - Algorithm parameters
   * @returns Algorithm results
   */
  async runAlgorithm(algorithm: string, parameters: Record<string, any>): Promise<QGISResponse> {
    logger.info('Running algorithm', { algorithm, parameters });
    
    return this.executeWithRetry(async () => {
      const response = await this.axiosInstance.post('/process/run_algorithm', {
        algorithm,
        parameters
      });
      
      if (!response.data.success) {
        throw new McpError(
          ErrorCode.InternalError,
          `Algorithm execution failed: ${response.data.error?.message || 'Unknown error'}`
        );
      }
      
      return response.data;
    });
  }

  /**
   * Check if the QGIS server is available
   * @returns True if server is available
   */
  static async checkServerAvailability(): Promise<boolean> {
    try {
      const baseUrl = process.env.QGIS_SERVER_URL || 'http://localhost:5000';
      const response = await fetch(`${baseUrl}/health`);
      
      if (!response.ok) {
        logger.error('QGIS server health check failed', { status: response.status });
        return false;
      }
      
      const data = await response.json();
      logger.info('QGIS server health check succeeded', { data });
      return true;
    } catch (error) {
      logger.error('QGIS server health check failed', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Call the QGIS server to perform watershed analysis
   * @param params Watershed analysis parameters
   * @returns Analysis results
   */
  static async performWatershedAnalysis(params: WatershedAnalysisParams): Promise<QGISResponse> {
    try {
      const baseUrl = process.env.QGIS_SERVER_URL || 'http://localhost:5000';
      logger.info('Calling QGIS server for watershed analysis', { params });
      
      const response = await fetch(`${baseUrl}/process/watershed_analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params)
      });
      
      if (!response.ok) {
        const error = await response.json();
        logger.error('Watershed analysis failed', { error });
        return { success: false, error };
      }
      
      const result = await response.json();
      logger.info('Watershed analysis completed successfully');
      return result;
    } catch (error) {
      logger.error('Error performing watershed analysis', { error: (error as Error).message });
      return {
        success: false,
        error: {
          message: `Failed to communicate with QGIS server: ${(error as Error).message}`,
          code: 'CONNECTION_ERROR'
        }
      };
    }
  }

  /**
   * Call the QGIS server to perform aspect analysis
   * @param params Aspect analysis parameters
   * @returns Analysis results
   */
  static async performAspectAnalysis(params: AspectAnalysisParams): Promise<QGISResponse> {
    try {
      const baseUrl = process.env.QGIS_SERVER_URL || 'http://localhost:5000';
      logger.info('Calling QGIS server for aspect analysis', { params });
      
      const response = await fetch(`${baseUrl}/process/aspect_analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params)
      });
      
      if (!response.ok) {
        const error = await response.json();
        logger.error('Aspect analysis failed', { error });
        return { success: false, error };
      }
      
      const result = await response.json();
      logger.info('Aspect analysis completed successfully');
      return result;
    } catch (error) {
      logger.error('Error performing aspect analysis', { error: (error as Error).message });
      return {
        success: false,
        error: {
          message: `Failed to communicate with QGIS server: ${(error as Error).message}`,
          code: 'CONNECTION_ERROR'
        }
      };
    }
  }

  /**
   * Call the QGIS server to perform viewshed analysis
   * @param params Viewshed analysis parameters
   * @returns Analysis results
   */
  static async performViewshedAnalysis(params: ViewshedAnalysisParams): Promise<QGISResponse> {
    try {
      const baseUrl = process.env.QGIS_SERVER_URL || 'http://localhost:5000';
      logger.info('Calling QGIS server for viewshed analysis', { params });
      
      const response = await fetch(`${baseUrl}/process/viewshed_analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params)
      });
      
      if (!response.ok) {
        const error = await response.json();
        logger.error('Viewshed analysis failed', { error });
        return { success: false, error };
      }
      
      const result = await response.json();
      logger.info('Viewshed analysis completed successfully');
      return result;
    } catch (error) {
      logger.error('Error performing viewshed analysis', { error: (error as Error).message });
      return {
        success: false,
        error: {
          message: `Failed to communicate with QGIS server: ${(error as Error).message}`,
          code: 'CONNECTION_ERROR'
        }
      };
    }
  }

  /**
   * Call the QGIS server to perform slope analysis
   * @param params Slope analysis parameters
   * @returns Analysis results
   */
  static async performSlopeAnalysis(params: SlopeAnalysisParams): Promise<QGISResponse> {
    try {
      const baseUrl = process.env.QGIS_SERVER_URL || 'http://localhost:5000';
      logger.info('Calling QGIS server for slope analysis', { params });
      
      const response = await fetch(`${baseUrl}/process/slope_analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params)
      });
      
      if (!response.ok) {
        const error = await response.json();
        logger.error('Slope analysis failed', { error });
        return { success: false, error };
      }
      
      const result = await response.json();
      logger.info('Slope analysis completed successfully');
      return result;
    } catch (error) {
      logger.error('Error performing slope analysis', { error: (error as Error).message });
      return {
        success: false,
        error: {
          message: `Failed to communicate with QGIS server: ${(error as Error).message}`,
          code: 'CONNECTION_ERROR'
        }
      };
    }
  }

  /**
   * Call the QGIS server to perform zoning analysis
   * @param params Zoning analysis parameters
   * @returns Analysis results
   */
  static async performZoningAnalysis(params: ZoningAnalysisParams): Promise<QGISResponse> {
    try {
      const baseUrl = process.env.QGIS_SERVER_URL || 'http://localhost:5000';
      logger.info('Calling QGIS server for zoning analysis', { params });
      
      const response = await fetch(`${baseUrl}/process/zoning_analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params)
      });
      
      if (!response.ok) {
        const error = await response.json();
        logger.error('Zoning analysis failed', { error });
        return { success: false, error };
      }
      
      const result = await response.json();
      logger.info('Zoning analysis completed successfully');
      return result;
    } catch (error) {
      logger.error('Error performing zoning analysis', { error: (error as Error).message });
      return {
        success: false,
        error: {
          message: `Failed to communicate with QGIS server: ${(error as Error).message}`,
          code: 'CONNECTION_ERROR'
        }
      };
    }
  }

  /**
   * Call the QGIS server to perform land use analysis
   * @param params Land use analysis parameters
   * @returns Analysis results
   */
  static async performLandUseAnalysis(params: LandUseAnalysisParams): Promise<QGISResponse> {
    try {
      const baseUrl = process.env.QGIS_SERVER_URL || 'http://localhost:5000';
      logger.info('Calling QGIS server for land use analysis', { params });
      
      const response = await fetch(`${baseUrl}/process/land_use_analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params)
      });
      
      if (!response.ok) {
        const error = await response.json();
        logger.error('Land use analysis failed', { error });
        return { success: false, error };
      }
      
      const result = await response.json();
      logger.info('Land use analysis completed successfully');
      return result;
    } catch (error) {
      logger.error('Error performing land use analysis', { error: (error as Error).message });
      return {
        success: false,
        error: {
          message: `Failed to communicate with QGIS server: ${(error as Error).message}`,
          code: 'CONNECTION_ERROR'
        }
      };
    }
  }

  /**
   * Call the QGIS server to perform development constraints analysis
   * @param params Development constraints analysis parameters
   * @returns Analysis results
   */
  static async performDevelopmentConstraintsAnalysis(params: DevelopmentConstraintsAnalysisParams): Promise<QGISResponse> {
    try {
      const baseUrl = process.env.QGIS_SERVER_URL || 'http://localhost:5000';
      logger.info('Calling QGIS server for development constraints analysis', { params });
      
      const response = await fetch(`${baseUrl}/process/development_constraints_analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params)
      });
      
      if (!response.ok) {
        const error = await response.json();
        logger.error('Development constraints analysis failed', { error });
        return { success: false, error };
      }
      
      const result = await response.json();
      logger.info('Development constraints analysis completed successfully');
      return result;
    } catch (error) {
      logger.error('Error performing development constraints analysis', { error: (error as Error).message });
      return {
        success: false,
        error: {
          message: `Failed to communicate with QGIS server: ${(error as Error).message}`,
          code: 'CONNECTION_ERROR'
        }
      };
    }
  }

  /**
   * Performs a topographic position analysis using the QGIS server
   * @param params - Topographic position analysis parameters
   * @returns Response from the QGIS server
   */
  static async performTopographicPositionAnalysis(params: any): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/topographic_position_analysis`, params);
      return response.data;
    } catch (error) {
      this.handleAxiosError(error, 'Failed to perform topographic position analysis');
    }
  }

  /**
   * Performs a terrain classification analysis using the QGIS server
   * @param params - Terrain classification analysis parameters
   * @returns Response from the QGIS server
   */
  static async performTerrainClassificationAnalysis(params: any): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/terrain_classification_analysis`, params);
      return response.data;
    } catch (error) {
      this.handleAxiosError(error, 'Failed to perform terrain classification analysis');
    }
  }

  /**
   * Performs a water flow analysis using the QGIS server
   * @param params - Water flow analysis parameters
   * @returns Response from the QGIS server
   */
  static async performWaterFlowAnalysis(params: any): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/water_flow_analysis`, params);
      return response.data;
    } catch (error) {
      this.handleAxiosError(error, 'Failed to perform water flow analysis');
    }
  }

  /**
   * Performs an infiltration analysis using the QGIS server
   * @param params - Infiltration analysis parameters
   * @returns Response from the QGIS server
   */
  static async performInfiltrationAnalysis(params: any): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/infiltration_analysis`, params);
      return response.data;
    } catch (error) {
      this.handleAxiosError(error, 'Failed to perform infiltration analysis');
    }
  }

  /**
   * Performs a runoff analysis using the QGIS server
   * @param params - Runoff analysis parameters
   * @returns Response from the QGIS server
   */
  static async performRunoffAnalysis(params: any): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/runoff_analysis`, params);
      return response.data;
    } catch (error) {
      this.handleAxiosError(error, 'Failed to perform runoff analysis');
    }
  }

  /**
   * Performs an ecosystem services analysis using the QGIS server
   * @param params - Ecosystem services analysis parameters
   * @returns Response from the QGIS server
   */
  static async performEcosystemServicesAnalysis(params: any): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/ecosystem_services_analysis`, params);
      return response.data;
    } catch (error) {
      this.handleAxiosError(error, 'Failed to perform ecosystem services analysis');
    }
  }
}

// Export a default instance
export default new QGISConnector(); 