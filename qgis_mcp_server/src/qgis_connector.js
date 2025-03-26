/**
 * QGIS Service Connector
 * 
 * This module provides a client for communicating with the QGIS Docker container's
 * HTTP API. It handles requests to perform terrain analysis operations.
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import winston from 'winston';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

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
  /**
   * Create a new QGIS connector
   * @param {Object} options - Connection options
   * @param {string} options.baseUrl - QGIS service base URL
   * @param {number} options.timeout - Request timeout in milliseconds
   * @param {number} options.maxRetries - Maximum number of retry attempts
   */
  constructor(options = {}) {
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
   * @returns {Promise<boolean>} True if the service is healthy
   */
  async checkHealth() {
    try {
      const response = await this.axiosInstance.get('/health');
      return response.data?.status === 'ok';
    } catch (error) {
      logger.error('Health check failed', { error: error.message });
      return false;
    }
  }
  
  /**
   * Get a list of available QGIS algorithms
   * @returns {Promise<Array>} List of algorithms
   */
  async getAlgorithms() {
    try {
      const response = await this.axiosInstance.get('/algorithms');
      return response.data?.algorithms || [];
    } catch (error) {
      logger.error('Failed to get algorithms', { error: error.message });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get QGIS algorithms: ${error.message}`
      );
    }
  }
  
  /**
   * Execute a request with retry logic
   * @param {Function} requestFn - Function that returns a Promise
   * @returns {Promise<any>} Response data
   */
  async executeWithRetry(requestFn) {
    let retries = 0;
    let lastError = null;
    
    while (retries < this.maxRetries) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;
        retries++;
        
        if (retries >= this.maxRetries) {
          break;
        }
        
        // Exponential backoff
        const delay = Math.pow(2, retries) * 1000;
        logger.warn(`Request failed, retrying in ${delay}ms (${retries}/${this.maxRetries})`, {
          error: error.message
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    logger.error(`Request failed after ${retries} retries`, {
      error: lastError.message
    });
    
    if (lastError instanceof McpError) {
      throw lastError;
    }
    
    throw new McpError(
      ErrorCode.InternalError,
      `QGIS request failed after ${retries} retries: ${lastError.message}`
    );
  }
  
  /**
   * Perform slope analysis on a DEM
   * @param {Object} params - Slope analysis parameters
   * @returns {Promise<Object>} Analysis results
   */
  async performSlopeAnalysis(params) {
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
   * @param {Object} params - Flow path analysis parameters
   * @returns {Promise<Object>} Analysis results
   */
  async performFlowPathAnalysis(params) {
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
   * @param {string} algorithm - Algorithm identifier
   * @param {Object} parameters - Algorithm parameters
   * @returns {Promise<Object>} Algorithm results
   */
  async runAlgorithm(algorithm, parameters) {
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
}

// Export a default instance
export default new QGISConnector();
