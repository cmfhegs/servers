/**
 * Tests for analysis operations
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { slopeAnalysis } from '../src/operations/terrain_analysis.js';
import { watershedAnalysis } from '../src/operations/watershed_analysis.js';
import { aspectAnalysis } from '../src/operations/aspect_analysis.js';
import { viewshedAnalysis } from '../src/operations/viewshed_analysis.js';
import QGISConnector from '../src/qgis_connector.js';

// Mock the QGISConnector
vi.mock('../src/qgis_connector.js', () => {
  return {
    default: {
      performSlopeAnalysis: vi.fn(),
      performFlowPathAnalysis: vi.fn(),
      performWatershedAnalysis: vi.fn(),
      performAspectAnalysis: vi.fn(),
      performViewshedAnalysis: vi.fn()
    }
  };
});

// Mock file system modules
vi.mock('fs', () => {
  return {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn()
  };
});

describe('Analysis Operations', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup successful response
    QGISConnector.performSlopeAnalysis.mockResolvedValue({
      success: true,
      data: { outputPath: '/output/slope.tif' }
    });
    
    QGISConnector.performWatershedAnalysis.mockResolvedValue({
      success: true,
      data: { outputPath: '/output/watershed.gpkg' }
    });
    
    QGISConnector.performAspectAnalysis.mockResolvedValue({
      success: true,
      data: { outputPath: '/output/aspect.tif' }
    });
    
    QGISConnector.performViewshedAnalysis.mockResolvedValue({
      success: true,
      data: { outputPath: '/output/viewshed.tif' }
    });
  });
  
  describe('Slope Analysis', () => {
    it('should validate required parameters', async () => {
      // Missing required parameters
      await expect(slopeAnalysis({})).rejects.toThrow('Missing required parameter: dem_path');
      
      // Only dem_path provided
      await expect(slopeAnalysis({ dem_path: 'dem.tif' })).rejects.toThrow('Missing required parameter: output_path');
    });
    
    it('should call performSlopeAnalysis with correct parameters', async () => {
      const params = {
        dem_path: 'dem.tif',
        output_path: 'slope.tif',
        slope_units: 'degrees'
      };
      
      await slopeAnalysis(params);
      
      expect(QGISConnector.performSlopeAnalysis).toHaveBeenCalledTimes(1);
      expect(QGISConnector.performSlopeAnalysis).toHaveBeenCalledWith(expect.objectContaining({
        dem_path: expect.any(String),
        output_path: expect.any(String),
        slope_units: 'degrees'
      }));
    });
  });
  
  describe('Watershed Analysis', () => {
    it('should validate required parameters', async () => {
      // Missing required parameters
      await expect(watershedAnalysis({})).rejects.toThrow('Missing required parameter: dem_path');
      
      // Only dem_path provided
      await expect(watershedAnalysis({ dem_path: 'dem.tif' })).rejects.toThrow('Missing required parameter: output_path');
    });
    
    it('should call performWatershedAnalysis with correct parameters', async () => {
      const params = {
        dem_path: 'dem.tif',
        output_path: 'watershed.gpkg',
        flow_accumulation_threshold: 1000
      };
      
      await watershedAnalysis(params);
      
      expect(QGISConnector.performWatershedAnalysis).toHaveBeenCalledTimes(1);
      expect(QGISConnector.performWatershedAnalysis).toHaveBeenCalledWith(expect.objectContaining({
        dem_path: expect.any(String),
        output_path: expect.any(String),
        flow_accumulation_threshold: 1000
      }));
    });
  });
  
  describe('Aspect Analysis', () => {
    it('should validate required parameters', async () => {
      // Missing required parameters
      await expect(aspectAnalysis({})).rejects.toThrow('Missing required parameter: dem_path');
      
      // Only dem_path provided
      await expect(aspectAnalysis({ dem_path: 'dem.tif' })).rejects.toThrow('Missing required parameter: output_path');
    });
    
    it('should call performAspectAnalysis with correct parameters', async () => {
      const params = {
        dem_path: 'dem.tif',
        output_path: 'aspect.tif',
        categories: 8
      };
      
      await aspectAnalysis(params);
      
      expect(QGISConnector.performAspectAnalysis).toHaveBeenCalledTimes(1);
      expect(QGISConnector.performAspectAnalysis).toHaveBeenCalledWith(expect.objectContaining({
        dem_path: expect.any(String),
        output_path: expect.any(String),
        categories: 8
      }));
    });
  });
  
  describe('Viewshed Analysis', () => {
    it('should validate required parameters', async () => {
      // Missing required parameters
      await expect(viewshedAnalysis({})).rejects.toThrow('Missing required parameter: dem_path');
      
      // Only dem_path provided
      await expect(viewshedAnalysis({ dem_path: 'dem.tif' })).rejects.toThrow('Missing required parameter: output_path');
    });
    
    it('should call performViewshedAnalysis with correct parameters', async () => {
      const params = {
        dem_path: 'dem.tif',
        output_path: 'viewshed.tif',
        observer_height: 1.8,
        radius: 1000
      };
      
      await viewshedAnalysis(params);
      
      expect(QGISConnector.performViewshedAnalysis).toHaveBeenCalledTimes(1);
      expect(QGISConnector.performViewshedAnalysis).toHaveBeenCalledWith(expect.objectContaining({
        dem_path: expect.any(String),
        output_path: expect.any(String),
        observer_height: 1.8,
        radius: 1000
      }));
    });
  });
}); 