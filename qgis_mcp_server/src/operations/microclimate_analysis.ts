/**
 * Microclimate Analysis Operation
 * 
 * This module implements microclimate analysis operations for QGIS.
 * It identifies microclimatic zones by combining temperature, wind, and humidity.
 */
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { BaseAnalysisResult, AnalysisMetadata } from '../../../src/types/analysis';
import { processError, validateDEM, prepareOutputDirectory } from './utils';
import { logger } from '../logger';

/**
 * Parameters for microclimate analysis
 */
interface MicroclimateParameters {
  type?: 'microclimate';
  demPath: string;
  outputPath?: string;
  projectId: string;
  jobId?: string;
  landCoverPath?: string;
  windDataPath?: string;
  humidityDataPath?: string;
  season?: string;
  timeOfDay?: string;
  resolution?: string | number;
}

/**
 * Microclimate category
 */
interface MicroclimateCategory {
  name: string;
  description: string;
  comfort_index: number;
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
 * Statistics for microclimate analysis
 */
interface MicroclimateStatistics {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  microclimateCategoryDistribution: Record<string, number>;
  areaByCategory: Record<string, number>;
  totalAreaHectares: number;
  elevationRange: [number, number];
  overallComfortIndex: number;
  biomimicryInsights: string[];
  microclimateCategoriesDefinition: MicroclimateCategory[];
  analyzedSeason: string;
  analyzedTimeOfDay: string;
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
 * Result for microclimate analysis
 */
interface MicroclimateResult extends BaseAnalysisResult {
  type: 'microclimate';
  analysisType: 'microclimate';
  parameters: MicroclimateParameters;
  microclimateLayer: GeoJSON.FeatureCollection;
  temperatureComponent?: GeoJSON.FeatureCollection;
  windComponent?: GeoJSON.FeatureCollection;
  humidityComponent?: GeoJSON.FeatureCollection;
  microclimateCategories: MicroclimateCategory[];
  statistics: MicroclimateStatistics;
  biomimicryInsights: string[];
  season: string;
  timeOfDay: string;
  overallComfortIndex: number;
}

/**
 * Execute microclimate analysis using QGIS processing
 * 
 * @param parameters - Microclimate analysis parameters
 * @returns Promise resolving to microclimate analysis result
 */
export async function executeMicroclimateAnalysis(
  parameters: MicroclimateParameters
): Promise<MicroclimateResult> {
  try {
    logger.info('Starting microclimate analysis with parameters:', parameters);
    
    // Validate input parameters
    if (!parameters.demPath) {
      throw new Error('DEM path is required for microclimate analysis');
    }
    
    // Validate DEM file
    await validateDEM(parameters.demPath);
    
    // Prepare output directory
    const outputDir = await prepareOutputDirectory(parameters.outputPath);
    
    // Generate unique ID for this analysis
    const analysisId = parameters.jobId || `microclimate-${uuidv4()}`;
    
    // Define output file paths
    const microclimateFile = path.join(outputDir, `${analysisId}_microclimate.geojson`);
    const statsFile = path.join(outputDir, `${analysisId}_stats.json`);
    const temperatureFile = path.join(outputDir, `${analysisId}_temperature.tif`);
    const windFile = path.join(outputDir, `${analysisId}_wind.tif`);
    const humidityFile = path.join(outputDir, `${analysisId}_humidity.tif`);
    
    // Set default season and time of day if not provided
    const season = parameters.season || 'summer';
    const timeOfDay = parameters.timeOfDay || 'afternoon';
    
    // Build Python script arguments
    const scriptArgs = [
      `--dem=${parameters.demPath}`,
      `--output=${microclimateFile}`,
      `--stats=${statsFile}`,
      `--season=${season}`,
      `--time-of-day=${timeOfDay}`
    ];
    
    // Add optional parameters if provided
    if (parameters.landCoverPath) {
      scriptArgs.push(`--land-cover=${parameters.landCoverPath}`);
    }
    
    if (parameters.windDataPath) {
      scriptArgs.push(`--wind-data=${parameters.windDataPath}`);
    }
    
    if (parameters.humidityDataPath) {
      scriptArgs.push(`--humidity-data=${parameters.humidityDataPath}`);
    }
    
    // Execute Python script for microclimate analysis
    const scriptPath = path.join(__dirname, '../../../qgis-docker/scripts/microclimate_analysis.py');
    const command = `python "${scriptPath}" ${scriptArgs.join(' ')}`;
    
    logger.debug('Executing command:', command);
    
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          logger.error('Microclimate analysis execution error:', error);
          logger.error('STDERR:', stderr);
          return reject(processError(error, stderr));
        }
        
        logger.debug('STDOUT:', stdout);
        
        try {
          // Read vector results
          const vectorData = fs.readFileSync(microclimateFile, 'utf8');
          const vectorGeoJSON = JSON.parse(vectorData);
          
          // Read statistics
          const statsData = fs.readFileSync(statsFile, 'utf8');
          const stats: MicroclimateStatistics = JSON.parse(statsData);
          
          // Create default categories if not provided in stats
          const microclimateCategories = stats.microclimateCategoriesDefinition || [
            {
              name: 'Hot-Dry',
              description: 'Areas with high temperature and low humidity',
              comfort_index: 1,
              color: '#FF0000',  // Red
              biomimicry_strategies: [
                'Implement passive cooling systems inspired by termite mounds',
                'Create self-shading structures based on desert plant morphology',
                'Design evaporative cooling features inspired by animal skin'
              ]
            },
            {
              name: 'Hot-Humid',
              description: 'Areas with high temperature and high humidity',
              comfort_index: 2,
              color: '#FF6600',  // Orange
              biomimicry_strategies: [
                'Design airflow patterns inspired by forest canopy structures',
                'Implement moisture management systems based on tropical plant leaves',
                'Create ventilation strategies inspired by termite mounds'
              ]
            },
            {
              name: 'Moderate',
              description: 'Areas with balanced temperature and humidity',
              comfort_index: 5,
              color: '#FFFF00',  // Yellow
              biomimicry_strategies: [
                'Maintain natural airflow patterns like woodland clearings',
                'Preserve existing vegetation for passive environmental control',
                'Design transitional spaces inspired by forest edges'
              ]
            },
            {
              name: 'Cool-Dry',
              description: 'Areas with low temperature and low humidity',
              comfort_index: 3,
              color: '#00FFFF',  // Cyan
              biomimicry_strategies: [
                'Design wind buffers inspired by animal grouping behaviors',
                'Create heat-capturing surfaces based on dark butterfly wings',
                'Implement thermal mass strategies inspired by rock formations'
              ]
            },
            {
              name: 'Cool-Humid',
              description: 'Areas with low temperature and high humidity',
              comfort_index: 4,
              color: '#0000FF',  // Blue
              biomimicry_strategies: [
                'Design moisture management systems inspired by moss and lichens',
                'Create condensing surfaces inspired by beetle carapaces',
                'Implement thermal insulation strategies from temperate forest layers'
              ]
            }
          ];
          
          // Create result object
          const result: MicroclimateResult = {
            id: analysisId,
            type: 'microclimate',
            analysisType: 'microclimate',
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
            microclimateLayer: vectorGeoJSON,
            microclimateCategories,
            biomimicryInsights: stats.biomimicryInsights || [
              'Design spaces that respond to local microclimate conditions like organisms in their habitats',
              'Create transitional buffer zones between different microclimatic areas based on ecotone principles',
              'Implement passive climate control strategies inspired by natural adaptations',
              'Develop material choices and spatial arrangements that enhance comfort in each microclimate zone'
            ],
            season: stats.analyzedSeason || season,
            timeOfDay: stats.analyzedTimeOfDay || timeOfDay,
            overallComfortIndex: stats.overallComfortIndex || 3,
            layers: [
              {
                id: `${analysisId}_microclimate`,
                name: 'Microclimate Zones',
                type: 'vector',
                url: microclimateFile,
                format: 'geojson',
                style: {
                  property: 'climate_value',
                  type: 'categorical',
                  stops: microclimateCategories.map(cat => [
                    cat.comfort_index,
                    cat.color
                  ])
                }
              },
              {
                id: `${analysisId}_temperature`,
                name: 'Temperature Component',
                type: 'raster',
                url: temperatureFile,
                format: 'raster'
              },
              {
                id: `${analysisId}_wind`,
                name: 'Wind Component',
                type: 'raster',
                url: windFile,
                format: 'raster'
              },
              {
                id: `${analysisId}_humidity`,
                name: 'Humidity Component',
                type: 'raster',
                url: humidityFile,
                format: 'raster'
              }
            ],
            jobId: parameters.jobId || analysisId,
            projectId: parameters.projectId
          };
          
          logger.info('Microclimate analysis completed successfully:', result.id);
          resolve(result);
        } catch (parseError) {
          logger.error('Error parsing microclimate analysis results:', parseError);
          reject(new Error(`Failed to parse microclimate analysis results: ${parseError.message}`));
        }
      });
    });
  } catch (error) {
    logger.error('Microclimate analysis error:', error);
    throw error;
  }
} 