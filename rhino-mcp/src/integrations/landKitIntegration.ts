/**
 * Land Kit Pro Integration
 * 
 * This file provides integration with Land Kit Pro, a professional landscape architecture toolkit
 * for Rhino. It enables McHarg layer-based analysis to leverage Land Kit's specialized functions.
 */

import axios from 'axios';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export interface LandKitConfig {
  apiUrl: string;
  apiKey: string;
  timeout?: number;
}

export class LandKitIntegration {
  private config: LandKitConfig;
  private axiosInstance;

  constructor(config: LandKitConfig) {
    this.config = {
      ...config,
      timeout: config.timeout || 30000 // Default 30s timeout
    };

    this.axiosInstance = axios.create({
      baseURL: this.config.apiUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Generate contours from a Digital Elevation Model using Land Kit
   */
  async generateContours(
    demPath: string,
    interval: number,
    smoothing: number = 0,
    parameters: Record<string, any> = {}
  ) {
    try {
      const response = await this.axiosInstance.post('/contours/generate', {
        dem_path: demPath,
        interval,
        smoothing,
        ...parameters
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new McpError(
          ErrorCode.InternalError,
          `Land Kit API error: ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Create terrain profiles using Land Kit
   */
  async createProfiles(
    demPath: string,
    profileLines: any[],
    sampleDistance: number = 1.0,
    parameters: Record<string, any> = {}
  ) {
    try {
      const response = await this.axiosInstance.post('/terrain/profiles', {
        dem_path: demPath,
        profile_lines: profileLines,
        sample_distance: sampleDistance,
        ...parameters
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new McpError(
          ErrorCode.InternalError,
          `Land Kit API error: ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Calculate cut and fill volumes using Land Kit
   */
  async calculateCutFill(
    existingDem: string,
    proposedDem: string,
    boundaryPolygon?: any,
    parameters: Record<string, any> = {}
  ) {
    try {
      const response = await this.axiosInstance.post('/grading/cutfill', {
        existing_dem: existingDem,
        proposed_dem: proposedDem,
        boundary_polygon: boundaryPolygon,
        ...parameters
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new McpError(
          ErrorCode.InternalError,
          `Land Kit API error: ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Generate watershed analysis using Land Kit
   */
  async analyzeWatersheds(
    demPath: string,
    pourPoints: any[],
    parameters: Record<string, any> = {}
  ) {
    try {
      const response = await this.axiosInstance.post('/hydrology/watersheds', {
        dem_path: demPath,
        pour_points: pourPoints,
        ...parameters
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new McpError(
          ErrorCode.InternalError,
          `Land Kit API error: ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Generate flow paths using Land Kit
   */
  async generateFlowPaths(
    demPath: string,
    startPoints: any[],
    maxDistance: number = 1000,
    parameters: Record<string, any> = {}
  ) {
    try {
      const response = await this.axiosInstance.post('/hydrology/flowpaths', {
        dem_path: demPath,
        start_points: startPoints,
        max_distance: maxDistance,
        ...parameters
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new McpError(
          ErrorCode.InternalError,
          `Land Kit API error: ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Generate viewshed analysis using Land Kit
   */
  async analyzeViewshed(
    demPath: string,
    viewerPoint: any,
    radius: number,
    viewerHeight: number = 1.7,
    parameters: Record<string, any> = {}
  ) {
    try {
      const response = await this.axiosInstance.post('/visibility/viewshed', {
        dem_path: demPath,
        viewer_point: viewerPoint,
        radius,
        viewer_height: viewerHeight,
        ...parameters
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new McpError(
          ErrorCode.InternalError,
          `Land Kit API error: ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Generate solar analysis using Land Kit
   */
  async analyzeSolar(
    demPath: string,
    date: string,
    timeRange: [string, string],
    interval: number = 60,
    parameters: Record<string, any> = {}
  ) {
    try {
      const response = await this.axiosInstance.post('/solar/radiation', {
        dem_path: demPath,
        date,
        time_range: timeRange,
        interval,
        ...parameters
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new McpError(
          ErrorCode.InternalError,
          `Land Kit API error: ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Apply vegetation to a site using Land Kit
   */
  async applyVegetation(
    siteBoundary: any,
    vegetationPlan: any,
    parameters: Record<string, any> = {}
  ) {
    try {
      const response = await this.axiosInstance.post('/vegetation/apply', {
        site_boundary: siteBoundary,
        vegetation_plan: vegetationPlan,
        ...parameters
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new McpError(
          ErrorCode.InternalError,
          `Land Kit API error: ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }
}
