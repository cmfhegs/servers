/**
 * Temperature Gradients Analysis Operation
 * 
 * This module implements temperature gradients analysis operations for QGIS.
 * It identifies microclimatic zones and thermal patterns across the landscape.
 */
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { BaseAnalysisResult, AnalysisMetadata } from '../../../src/types/analysis';
import { processError, validateDEM, prepareOutputDirectory } from './utils';
import { logger } from '../logger';

/**
 * Parameters for temperature gradients analysis
 */
interface TemperatureGradientsParameters {
  type?: 'temperature_gradients';
  demPath: string;
  outputPath?: string;
  projectId: string;
  jobId?: string;
  landCoverPath?: string;
  season?: string;
  timeOfDay?: string;
  latitude?: number;
  humidityData?: string;
  windData?: string;
  resolution?: string | number;
}

/**
 * Temperature category
 */
interface TemperatureCategory {
  name: string;
  description: string;
  min_temp: number;
  max_temp: number;
  color: string;
  biomimicry_strategies: string[];
}

/**
 * Biomimicry strategy
 */
interface BiomimicryStrategy {
  name: string;
  organism: string;
  mechanism: string;
  application: string;
}

/**
 * Statistics for temperature gradients analysis
 */
interface TemperatureGradientsStatistics {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  temperatureDistribution: Record<string, number>;
  areaByCategory: Record<string, number>;
  totalAreaHectares: number;
  elevationRange: [number, number];
  biomimicryInsights: string[];
  temperatureCategories: TemperatureCategory[];
  estimatedBaseTemperature: number;
  estimatedTemperatureRange: number;
  analyzedSeason: string;
  analyzedTimeOfDay: string;
  biomimicryStrategies: {
    structural: BiomimicryStrategy[];
    material: BiomimicryStrategy[];
    behavioral: BiomimicryStrategy[];
  };
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
 * Result for temperature gradients analysis
 */
interface TemperatureGradientsResult extends BaseAnalysisResult {
  type: 'temperature_gradients';
  analysisType: 'temperature_gradients';
  parameters: TemperatureGradientsParameters;
  temperatureLayer: GeoJSON.FeatureCollection;
  temperatureCategories: TemperatureCategory[];
  statistics: TemperatureGradientsStatistics;
  biomimicryInsights: string[];
  season: string;
  timeOfDay: string;
}

/**
 * Execute temperature gradients analysis using QGIS processing
 * 
 * @param parameters - Temperature gradients analysis parameters
 * @returns Promise resolving to temperature gradients analysis result
 */
export async function executeTemperatureGradientsAnalysis(
  parameters: TemperatureGradientsParameters
): Promise<TemperatureGradientsResult> {
  try {
    logger.info('Starting temperature gradients analysis with parameters:', parameters);
    
    // Validate input parameters
    if (!parameters.demPath) {
      throw new Error('DEM path is required for temperature gradients analysis');
    }
    
    // Validate DEM file
    await validateDEM(parameters.demPath);
    
    // Prepare output directory
    const outputDir = await prepareOutputDirectory(parameters.outputPath);
    
    // Generate unique ID for this analysis
    const analysisId = parameters.jobId || `temperature-gradients-${uuidv4()}`;
    
    // Define output file paths
    const temperatureFile = path.join(outputDir, `${analysisId}_temperature.geojson`);
    const statsFile = path.join(outputDir, `${analysisId}_stats.json`);
    const combinedTempFile = path.join(outputDir, `${analysisId}_combined.tif`);
    
    // Set default season and time of day if not provided
    const season = parameters.season || 'summer';
    const timeOfDay = parameters.timeOfDay || 'afternoon';
    
    // Build Python script arguments
    const scriptArgs = [
      `--dem=${parameters.demPath}`,
      `--output=${temperatureFile}`,
      `--stats=${statsFile}`,
      `--season=${season}`,
      `--time-of-day=${timeOfDay}`
    ];
    
    // Add optional parameters if provided
    if (parameters.landCoverPath) {
      scriptArgs.push(`--land-cover=${parameters.landCoverPath}`);
    }
    
    if (parameters.latitude) {
      scriptArgs.push(`--latitude=${parameters.latitude}`);
    }
    
    if (parameters.humidityData) {
      scriptArgs.push(`--humidity-data=${parameters.humidityData}`);
    }
    
    if (parameters.windData) {
      scriptArgs.push(`--wind-data=${parameters.windData}`);
    }
    
    // Execute Python script for temperature gradients analysis
    const scriptPath = path.join(__dirname, '../../../qgis-docker/scripts/temperature_gradients_analysis.py');
    const command = `python "${scriptPath}" ${scriptArgs.join(' ')}`;
    
    logger.debug('Executing command:', command);
    
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          logger.error('Temperature gradients analysis execution error:', error);
          logger.error('STDERR:', stderr);
          return reject(processError(error, stderr));
        }
        
        logger.debug('STDOUT:', stdout);
        
        try {
          // Read vector results
          const vectorData = fs.readFileSync(temperatureFile, 'utf8');
          const vectorGeoJSON = JSON.parse(vectorData);
          
          // Read statistics
          const statsData = fs.readFileSync(statsFile, 'utf8');
          const stats: TemperatureGradientsStatistics = JSON.parse(statsData);
          
          // Create default categories if not provided in stats
          const temperatureCategories = stats.temperatureCategories || [
            {
              name: 'Very Warm Zone',
              description: 'Areas with consistently high temperatures',
              min_temp: 25,
              max_temp: 50,
              color: '#FF0000',  // Red
              biomimicry_strategies: [
                'Implement passive cooling strategies inspired by termite mounds',
                'Design self-shading structures modeled after desert plants',
                'Create evaporative cooling features based on perspiring mammals'
              ]
            },
            {
              name: 'Warm Zone',
              description: 'Areas with moderately high temperatures',
              min_temp: 20,
              max_temp: 25,
              color: '#FFA500',  // Orange
              biomimicry_strategies: [
                'Design transitional thermal buffers inspired by animal burrows',
                'Implement material transitions based on insulating fur patterns',
                'Create air circulation systems inspired by savanna ecosystems'
              ]
            },
            {
              name: 'Moderate Zone',
              description: 'Areas with balanced temperatures',
              min_temp: 15,
              max_temp: 20,
              color: '#FFFF00',  // Yellow
              biomimicry_strategies: [
                'Design thermal comfort strategies based on temperate forest layers',
                'Implement adaptive facades inspired by responsive plant structures',
                'Create human activity patterns based on animal behavior during moderate conditions'
              ]
            },
            {
              name: 'Cool Zone',
              description: 'Areas with moderately low temperatures',
              min_temp: 10,
              max_temp: 15,
              color: '#00FFFF',  // Cyan
              biomimicry_strategies: [
                'Design thermal retention features based on animal huddling behavior',
                'Implement insulating materials inspired by overlapping feathers',
                'Create directional solar exposure systems inspired by mountain ecosystems'
              ]
            },
            {
              name: 'Very Cool Zone',
              description: 'Areas with consistently low temperatures',
              min_temp: -10,
              max_temp: 10,
              color: '#0000FF',  // Blue
              biomimicry_strategies: [
                'Implement heat conservation strategies inspired by arctic animals',
                'Design compact spatial arrangements based on alpine plant communities',
                'Create thermal storage systems modeled after thermal mass adaptations'
              ]
            }
          ];
          
          // Create result object
          const result: TemperatureGradientsResult = {
            id: analysisId,
            type: 'temperature_gradients',
            analysisType: 'temperature_gradients',
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
            temperatureLayer: vectorGeoJSON,
            temperatureCategories,
            biomimicryInsights: stats.biomimicryInsights || [
              'Design buildings that respond to thermal zones like organisms in nature',
              'Implement passive heating and cooling strategies inspired by animal adaptations',
              'Create microclimate corridors inspired by animal migration patterns',
              'Use materials with thermal properties inspired by natural adaptations'
            ],
            season: stats.analyzedSeason || season,
            timeOfDay: stats.analyzedTimeOfDay || timeOfDay,
            layers: [
              {
                id: `${analysisId}_temperature`,
                name: 'Temperature Gradients',
                type: 'vector',
                url: temperatureFile,
                format: 'geojson',
                style: {
                  property: 'temp_value',
                  type: 'categorical',
                  stops: temperatureCategories.map(cat => [
                    cat.min_temp,
                    cat.color
                  ])
                }
              },
              {
                id: `${analysisId}_combined_temp`,
                name: 'Combined Temperature Raster',
                type: 'raster',
                url: combinedTempFile,
                format: 'raster'
              }
            ],
            jobId: parameters.jobId || analysisId,
            projectId: parameters.projectId
          };
          
          logger.info('Temperature gradients analysis completed successfully:', result.id);
          resolve(result);
        } catch (parseError) {
          logger.error('Error parsing temperature gradients analysis results:', parseError);
          reject(new Error(`Failed to parse temperature gradients analysis results: ${parseError.message}`));
        }
      });
    });
  } catch (error) {
    logger.error('Temperature gradients analysis error:', error);
    throw error;
  }
} 