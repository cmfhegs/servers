import path from 'path';
import { QGISConnector } from '../../qgis_connector';

// Type definitions for Development Potential Analysis
export interface DevelopmentPotentialParams {
  // Input parameters
  demFilePath: string;
  projectName: string;
  outputDir: string;
  
  // Development potential specific parameters
  zoningLayers?: string[];
  landUseLayers?: string[];
  slopeThreshold?: number;
  proximityToRoads?: number;
  proximityToUtilities?: number;
  environmentalConstraints?: string[];
  economicFactors?: {
    landValue?: number;
    developmentCost?: number;
    roi?: number;
  };
  marketDemand?: {
    residential?: number;
    commercial?: number;
    industrial?: number;
    mixed?: number;
  };
  regulatoryWeighting?: number;
  weightings?: {
    accessibility?: number;
    infrastructure?: number;
    environmental?: number;
    economic?: number;
    social?: number;
  };
}

export interface DevelopmentPotentialResult {
  potentialScoreLayer: string;
  suitableAreasVector: string;
  developmentZonesLayer: string;
  statistics: {
    highPotentialAreaHa: number;
    moderatePotentialAreaHa: number;
    lowPotentialAreaHa: number;
    unsuitable: number;
    averagePotentialScore: number;
  };
  categories: {
    name: string;
    area: number;
    percentage: number;
    color: string;
  }[];
  metadata: {
    analysisTimestamp: string;
    dataUsed: string[];
    algorithmVersion: string;
  };
}

/**
 * Development Potential Analysis - Evaluates and quantifies the suitability of land for various
 * types of development based on multiple factors including zoning regulations, infrastructure
 * proximity, environmental constraints, economic viability, and market conditions.
 */
export class DevelopmentPotentialAnalysis {
  private connector: QGISConnector;

  constructor(connector: QGISConnector) {
    this.connector = connector;
  }

  /**
   * Performs a comprehensive development potential analysis
   * 
   * @param params Parameters for the development potential analysis
   * @returns The analysis results including output layers and statistics
   */
  async runAnalysis(params: DevelopmentPotentialParams): Promise<DevelopmentPotentialResult> {
    // Input validation
    this.validateInputs(params);
    
    // Resolve paths
    const resolvedDemPath = path.resolve(params.demFilePath);
    const resolvedOutputDir = path.resolve(params.outputDir);
    
    // Default values for optional parameters
    const defaultParams: Partial<DevelopmentPotentialParams> = {
      slopeThreshold: 15,
      proximityToRoads: 1000,
      proximityToUtilities: 500,
      regulatoryWeighting: 0.8,
      weightings: {
        accessibility: 0.20,
        infrastructure: 0.25,
        environmental: 0.20,
        economic: 0.25,
        social: 0.10
      }
    };
    
    // Merge defaults with provided params
    const mergedParams = { ...defaultParams, ...params };
    
    // Ensure the weightings object exists
    if (!mergedParams.weightings) {
      mergedParams.weightings = defaultParams.weightings;
    }
    
    // Prepare the parameters for the Python script
    const scriptParams = {
      dem_file_path: resolvedDemPath,
      project_name: params.projectName,
      output_dir: resolvedOutputDir,
      zoning_layers: params.zoningLayers || [],
      land_use_layers: params.landUseLayers || [],
      slope_threshold: mergedParams.slopeThreshold,
      proximity_to_roads: mergedParams.proximityToRoads,
      proximity_to_utilities: mergedParams.proximityToUtilities,
      environmental_constraints: params.environmentalConstraints || [],
      economic_factors: params.economicFactors || {},
      market_demand: params.marketDemand || {},
      regulatory_weighting: mergedParams.regulatoryWeighting,
      weightings: mergedParams.weightings
    };
    
    // Execute the Python script via the QGIS connector
    try {
      const result = await this.connector.executeScript(
        'development_potential_analysis.py',
        scriptParams
      );
      
      // Transform the Python result to the TypeScript interface
      const analysisResult: DevelopmentPotentialResult = {
        potentialScoreLayer: result.potential_score_layer,
        suitableAreasVector: result.suitable_areas_vector,
        developmentZonesLayer: result.development_zones_layer,
        statistics: {
          highPotentialAreaHa: result.statistics.high_potential_area_ha,
          moderatePotentialAreaHa: result.statistics.moderate_potential_area_ha,
          lowPotentialAreaHa: result.statistics.low_potential_area_ha,
          unsuitable: result.statistics.unsuitable,
          averagePotentialScore: result.statistics.average_potential_score
        },
        categories: result.categories.map((category: any) => ({
          name: category.name,
          area: category.area,
          percentage: category.percentage,
          color: category.color
        })),
        metadata: {
          analysisTimestamp: result.metadata.analysis_timestamp,
          dataUsed: result.metadata.data_used,
          algorithmVersion: result.metadata.algorithm_version
        }
      };
      
      return analysisResult;
    } catch (error) {
      console.error('Error during development potential analysis:', error);
      throw new Error(`Development potential analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Validates the input parameters for development potential analysis
   * 
   * @param params The parameters to validate
   */
  private validateInputs(params: DevelopmentPotentialParams): void {
    if (!params.demFilePath) {
      throw new Error('DEM file path is required');
    }
    
    if (!params.projectName) {
      throw new Error('Project name is required');
    }
    
    if (!params.outputDir) {
      throw new Error('Output directory is required');
    }
    
    // Validate numeric parameters
    if (params.slopeThreshold !== undefined && (params.slopeThreshold < 0 || params.slopeThreshold > 90)) {
      throw new Error('Slope threshold must be between 0 and 90 degrees');
    }
    
    if (params.proximityToRoads !== undefined && params.proximityToRoads < 0) {
      throw new Error('Proximity to roads must be a positive value');
    }
    
    if (params.proximityToUtilities !== undefined && params.proximityToUtilities < 0) {
      throw new Error('Proximity to utilities must be a positive value');
    }
    
    // Validate weightings (must sum to 1.0)
    if (params.weightings) {
      const weights = params.weightings;
      const sum = (weights.accessibility || 0) + 
                  (weights.infrastructure || 0) + 
                  (weights.environmental || 0) + 
                  (weights.economic || 0) + 
                  (weights.social || 0);
      
      if (Math.abs(sum - 1.0) > 0.01) {
        throw new Error(`Weightings must sum to 1.0, but they sum to ${sum}`);
      }
    }
    
    // Validate regulatory weighting (must be between 0 and 1)
    if (params.regulatoryWeighting !== undefined && 
        (params.regulatoryWeighting < 0 || params.regulatoryWeighting > 1)) {
      throw new Error('Regulatory weighting must be between 0 and 1');
    }
  }
} 