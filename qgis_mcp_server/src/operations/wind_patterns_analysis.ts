/**
 * Wind Patterns Analysis Operation
 * 
 * This module implements wind pattern analysis operations for QGIS.
 * It identifies areas with different wind exposure and speed characteristics.
 */
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { BaseAnalysisResult, AnalysisMetadata } from '../../../src/types/analysis';
import { processError, validateDEM, prepareOutputDirectory } from './utils';
import { logger } from '../logger';

/**
 * Parameters for wind patterns analysis
 */
interface WindPatternsParameters {
  type?: 'wind_patterns';
  demPath: string;
  outputPath?: string;
  projectId: string;
  jobId?: string;
  windDirection?: number;
  windSpeed?: number;
  landCoverPath?: string;
  season?: string;
  resolution?: string | number;
}

/**
 * Wind category
 */
interface WindCategory {
  name: string;
  description: string;
  value: number;
  color: string;
  biomimicry_strategies: string[];
}

/**
 * Statistics for wind patterns analysis
 */
interface WindPatternsStatistics {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  windCategoryDistribution: Record<string, number>;
  areaByCategory: Record<string, number>;
  totalAreaHectares: number;
  elevationRange: [number, number];
  windDirection: number;
  windDirectionCardinal: string;
  windSpeedRange: [number, number];
  windSpeedMean: number;
  biomimicryInsights: string[];
  windCategoriesDefinition: WindCategory[];
  analyzedSeason: string;
  histogram: Array<{
    range: [number, number];
    label: string;
    count: number;
    area: number;
    percentage: number;
  }>;
  processingTime: number;
}

/**
 * Result for wind patterns analysis
 */
interface WindPatternsResult extends BaseAnalysisResult {
  type: 'wind_patterns';
  analysisType: 'wind_patterns';
  parameters: WindPatternsParameters;
  windPatternsLayer: GeoJSON.FeatureCollection;
  windExposureLayer?: GeoJSON.FeatureCollection;
  windSpeedLayer?: GeoJSON.FeatureCollection;
  windCategories: WindCategory[];
  statistics: WindPatternsStatistics;
  biomimicryInsights: string[];
  season: string;
  windDirection: number;
  windDirectionCardinal: string;
}

/**
 * Execute wind patterns analysis using QGIS processing
 * 
 * @param parameters - Wind patterns analysis parameters
 * @returns Promise resolving to wind patterns analysis result
 */
export async function executeWindPatternsAnalysis(
  parameters: WindPatternsParameters
): Promise<WindPatternsResult> {
  try {
    logger.info('Starting wind patterns analysis with parameters:', parameters);
    
    // Validate input parameters
    if (!parameters.demPath) {
      throw new Error('DEM path is required for wind patterns analysis');
    }
    
    // Validate DEM file
    await validateDEM(parameters.demPath);
    
    // Prepare output directory
    const outputDir = await prepareOutputDirectory(parameters.outputPath);
    
    // Generate unique ID for this analysis
    const analysisId = parameters.jobId || `wind-patterns-${uuidv4()}`;
    
    // Define output file paths
    const windPatternsFile = path.join(outputDir, `${analysisId}_wind_patterns.geojson`);
    const statsFile = path.join(outputDir, `${analysisId}_stats.json`);
    const windExposureFile = path.join(outputDir, `${analysisId}_wind_exposure.tif`);
    const windSpeedFile = path.join(outputDir, `${analysisId}_wind_speed.tif`);
    
    // Set default parameters if not provided
    const windDirection = parameters.windDirection || 270; // Default: west wind
    const windSpeed = parameters.windSpeed || 5.0; // Default: 5 m/s
    const season = parameters.season || 'annual'; // Default: annual average
    
    // Build Python script arguments
    const scriptArgs = [
      `--dem=${parameters.demPath}`,
      `--output=${windPatternsFile}`,
      `--stats=${statsFile}`,
      `--wind-direction=${windDirection}`,
      `--wind-speed=${windSpeed}`,
      `--season=${season}`
    ];
    
    // Add optional parameters if provided
    if (parameters.landCoverPath) {
      scriptArgs.push(`--land-cover=${parameters.landCoverPath}`);
    }
    
    // Execute Python script for wind patterns analysis
    const scriptPath = path.join(__dirname, '../../../qgis-docker/scripts/wind_patterns_analysis.py');
    const command = `python "${scriptPath}" ${scriptArgs.join(' ')}`;
    
    logger.debug('Executing command:', command);
    
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          logger.error('Wind patterns analysis execution error:', error);
          logger.error('STDERR:', stderr);
          return reject(processError(error, stderr));
        }
        
        logger.debug('STDOUT:', stdout);
        
        try {
          // Read vector results
          const vectorData = fs.readFileSync(windPatternsFile, 'utf8');
          const vectorGeoJSON = JSON.parse(vectorData);
          
          // Read statistics
          const statsData = fs.readFileSync(statsFile, 'utf8');
          const stats: WindPatternsStatistics = JSON.parse(statsData);
          
          // Create default categories if not provided in stats
          const windCategories = stats.windCategoriesDefinition || [
            {
              name: 'High Exposure',
              description: 'Areas with strong wind exposure and high wind speeds',
              value: 5,
              color: '#FF0000',  // Red
              biomimicry_strategies: [
                'Create wind-resistant structures inspired by prairie grasses',
                'Design flexible building envelopes based on bird wing feathers',
                'Implement wind energy harvesting systems modeled on falcon flight'
              ]
            },
            {
              name: 'Moderate-High Exposure',
              description: 'Areas with notable wind exposure and moderate-high speeds',
              value: 4,
              color: '#FFA500',  // Orange
              biomimicry_strategies: [
                'Design aerodynamic forms based on streamlined animal bodies',
                'Create semi-protected spaces inspired by animal windbreaks',
                'Implement dynamic facade elements that adjust to wind like leaves'
              ]
            },
            {
              name: 'Moderate Exposure',
              description: 'Areas with moderate wind exposure and speeds',
              value: 3,
              color: '#FFFF00',  // Yellow
              biomimicry_strategies: [
                'Create transitional spaces similar to forest edges',
                'Design semi-porous wind buffers inspired by hedgerows',
                'Implement moderate wind energy capture systems'
              ]
            },
            {
              name: 'Low-Moderate Exposure',
              description: 'Areas with some wind protection and lower speeds',
              value: 2,
              color: '#00FF00',  // Green
              biomimicry_strategies: [
                'Create comfortable outdoor spaces using natural terrain features',
                'Design passive ventilation inspired by termite mounds',
                'Implement wind-protected plant communities similar to natural assemblages'
              ]
            },
            {
              name: 'Low Exposure',
              description: 'Areas with significant wind protection and low speeds',
              value: 1,
              color: '#0000FF',  // Blue
              biomimicry_strategies: [
                'Design sheltered microclimates inspired by forest understory',
                'Create wind-protected gathering spaces based on animal shelter',
                'Implement smart ventilation to prevent stagnant air conditions'
              ]
            }
          ];
          
          // Create result object
          const result: WindPatternsResult = {
            id: analysisId,
            type: 'wind_patterns',
            analysisType: 'wind_patterns',
            timestamp: new Date().toISOString(),
            status: 'completed',
            parameters: parameters,
            metadata: {
              timestamp: new Date().toISOString(),
              duration: stats.processingTime || 0,
              processor: 'QGIS',
              version: '3.x',
              crs: vectorGeoJSON.crs?.properties?.name || '',
              demFile: path.basename(parameters.demPath)
            },
            statistics: stats,
            windPatternsLayer: vectorGeoJSON,
            windCategories,
            biomimicryInsights: stats.biomimicryInsights || [
              'Design buildings and landscapes that respond to wind patterns like organisms in their habitats',
              'Position wind-sensitive elements with consideration for predominant wind directions',
              'Implement wind protection strategies inspired by natural windbreaks',
              'Create building forms that optimize airflow similar to streamlined organisms'
            ],
            season: stats.analyzedSeason || season,
            windDirection: stats.windDirection || windDirection,
            windDirectionCardinal: stats.windDirectionCardinal || 'West',
            layers: [
              {
                id: `${analysisId}_wind_patterns`,
                name: 'Wind Pattern Zones',
                type: 'vector',
                url: windPatternsFile,
                format: 'geojson',
                style: {
                  property: 'wind_value',
                  type: 'categorical',
                  stops: windCategories.map(cat => [
                    cat.value,
                    cat.color
                  ])
                }
              },
              {
                id: `${analysisId}_wind_exposure`,
                name: 'Wind Exposure',
                type: 'raster',
                url: windExposureFile,
                format: 'raster'
              },
              {
                id: `${analysisId}_wind_speed`,
                name: 'Wind Speed',
                type: 'raster',
                url: windSpeedFile,
                format: 'raster'
              }
            ],
            jobId: parameters.jobId || analysisId,
            projectId: parameters.projectId
          };
          
          logger.info('Wind patterns analysis completed successfully:', result.id);
          resolve(result);
        } catch (parseError) {
          logger.error('Error parsing wind patterns analysis results:', parseError);
          reject(new Error(`Failed to parse wind patterns analysis results: ${parseError.message}`));
        }
      });
    });
  } catch (error) {
    logger.error('Wind patterns analysis error:', error);
    throw error;
  }
} 