/**
 * Sun Exposure Analysis Operation
 * 
 * This module implements sun exposure analysis operations for QGIS.
 * It analyzes seasonal sunlight patterns to identify optimal biomimetic strategies.
 */
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { BaseAnalysisResult, AnalysisMetadata } from '../../../src/types/analysis';
import { processError, validateDEM, prepareOutputDirectory } from './utils';
import { logger } from '../logger';

/**
 * Parameters for sun exposure analysis
 */
interface SunExposureParameters {
  type?: 'sun_exposure';
  demPath: string;
  outputPath?: string;
  projectId: string;
  jobId?: string;
  latitude?: number;
  longitude?: number;
  seasons?: string;
  dayHours?: string;
  skyModel?: 'clear_sky' | 'uniform' | 'standard_overcast';
  resolution?: string | number;
}

/**
 * Sun exposure category
 */
interface SunExposureCategory {
  name: string;
  description: string;
  min_hours: number;
  max_hours: number;
  color: string;
  biomimicry_strategies: string[];
}

/**
 * Statistics for sun exposure analysis
 */
interface SunExposureStatistics {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  exposureDistribution: Record<string, number>;
  areaByCategory: Record<string, number>;
  totalAreaHectares: number;
  analyzedSeasons: string[];
  elevationRange: [number, number];
  biomimicryInsights: string[];
  exposureCategories: SunExposureCategory[];
  histogram: Array<{
    range: [number, number];
    label: string;
    count: number;
    area: number;
    percentage: number;
  }>;
}

/**
 * Result for sun exposure analysis
 */
interface SunExposureResult extends BaseAnalysisResult {
  type: 'sun_exposure';
  analysisType: 'sun_exposure';
  parameters: SunExposureParameters;
  sunExposureLayer: GeoJSON.FeatureCollection;
  seasonalLayers?: Record<string, string>;
  exposureCategories: SunExposureCategory[];
  statistics: SunExposureStatistics;
  biomimicryInsights: string[];
  analyzedSeasons: string[];
}

/**
 * Execute sun exposure analysis using QGIS processing
 * 
 * @param parameters - Sun exposure analysis parameters
 * @returns Promise resolving to sun exposure analysis result
 */
export async function executeSunExposureAnalysis(
  parameters: SunExposureParameters
): Promise<SunExposureResult> {
  try {
    logger.info('Starting sun exposure analysis with parameters:', parameters);
    
    // Validate input parameters
    if (!parameters.demPath) {
      throw new Error('DEM path is required for sun exposure analysis');
    }
    
    // Validate DEM file
    await validateDEM(parameters.demPath);
    
    // Prepare output directory
    const outputDir = await prepareOutputDirectory(parameters.outputPath);
    
    // Generate unique ID for this analysis
    const analysisId = parameters.jobId || `sun-exposure-${uuidv4()}`;
    
    // Define output file paths
    const sunExposureFile = path.join(outputDir, `${analysisId}_sun_exposure.geojson`);
    const statsFile = path.join(outputDir, `${analysisId}_stats.json`);
    
    // Build Python script arguments
    const scriptArgs = [
      `--dem=${parameters.demPath}`,
      `--output=${sunExposureFile}`,
      `--stats=${statsFile}`
    ];
    
    // Add optional parameters if provided
    if (parameters.latitude) {
      scriptArgs.push(`--latitude=${parameters.latitude}`);
    }
    
    if (parameters.longitude) {
      scriptArgs.push(`--longitude=${parameters.longitude}`);
    }
    
    if (parameters.seasons) {
      scriptArgs.push(`--seasons=${parameters.seasons}`);
    }
    
    if (parameters.dayHours) {
      scriptArgs.push(`--day-hours=${parameters.dayHours}`);
    }
    
    if (parameters.skyModel) {
      scriptArgs.push(`--sky-model=${parameters.skyModel}`);
    }
    
    // Execute Python script for sun exposure analysis
    const scriptPath = path.join(__dirname, '../../../qgis-docker/scripts/sun_exposure_analysis.py');
    const command = `python "${scriptPath}" ${scriptArgs.join(' ')}`;
    
    logger.debug('Executing command:', command);
    
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          logger.error('Sun exposure analysis execution error:', error);
          logger.error('STDERR:', stderr);
          return reject(processError(error, stderr));
        }
        
        logger.debug('STDOUT:', stdout);
        
        try {
          // Read vector results
          const vectorData = fs.readFileSync(sunExposureFile, 'utf8');
          const vectorGeoJSON = JSON.parse(vectorData);
          
          // Read statistics
          const statsData = fs.readFileSync(statsFile, 'utf8');
          const stats: SunExposureStatistics = JSON.parse(statsData);
          
          // Get exposure categories from stats
          const exposureCategories = stats.exposureCategories || [
            {
              name: 'Very High Exposure',
              description: 'Areas with maximum sunlight throughout the year',
              min_hours: 8,
              max_hours: 24,
              color: '#FF4500',
              biomimicry_strategies: [
                'Implement sun-tracking mechanisms inspired by heliotropic plants',
                'Create self-shading structures based on cactus morphology',
                'Design radiative cooling surfaces inspired by Saharan silver ants'
              ]
            },
            {
              name: 'High Exposure',
              description: 'Significant sun exposure suitable for solar applications',
              min_hours: 6,
              max_hours: 8,
              color: '#FFA500',
              biomimicry_strategies: [
                'Design adaptive shading based on responsive plant structures',
                'Implement seasonal energy storage systems inspired by deciduous trees',
                'Create light-diffusing surfaces modeled after translucent leaves'
              ]
            },
            {
              name: 'Moderate Exposure',
              description: 'Balanced sun exposure with seasonal variations',
              min_hours: 4,
              max_hours: 6,
              color: '#FFFF00',
              biomimicry_strategies: [
                'Design mixed-light strategies inspired by forest understory plants',
                'Create dynamic sunlight harvesting systems based on coral reef organisms',
                'Implement seasonal adaptation mechanisms like deciduous behavior'
              ]
            },
            {
              name: 'Low Exposure',
              description: 'Limited direct sunlight, suitable for shade-adapted strategies',
              min_hours: 2,
              max_hours: 4,
              color: '#7CFC00',
              biomimicry_strategies: [
                'Design efficient light-harvesting systems inspired by shade plants',
                'Create cooling microclimates based on forest floor ecosystems',
                'Implement heat-conservation strategies from shade-dwelling organisms'
              ]
            },
            {
              name: 'Very Low Exposure',
              description: 'Minimal direct sunlight, requiring specialized approaches',
              min_hours: 0,
              max_hours: 2,
              color: '#006400',
              biomimicry_strategies: [
                'Design for diffused light utilization inspired by deep forest plants',
                'Create specialized light-capturing geometries based on cave-dwelling organisms',
                'Implement thermal regulation strategies from nocturnal animals'
              ]
            }
          ];
          
          // Create result object
          const result: SunExposureResult = {
            id: analysisId,
            type: 'sun_exposure',
            analysisType: 'sun_exposure',
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
            sunExposureLayer: vectorGeoJSON,
            exposureCategories,
            biomimicryInsights: stats.biomimicryInsights || [
              'High sun exposure areas can utilize strategies from sun-adapted organisms like desert plants',
              'Moderate sun exposure zones are ideal for strategies inspired by transitional ecosystems',
              'Low sun exposure regions can apply adaptations from forest understory species',
              'Seasonal variation in sun exposure suggests implementing strategies inspired by deciduous trees',
              'Consider three-dimensional sun exposure patterns inspired by forest canopy structure'
            ],
            analyzedSeasons: stats.analyzedSeasons || ['spring', 'summer', 'fall', 'winter'],
            layers: [
              {
                id: `${analysisId}_sun_exposure`,
                name: 'Sun Exposure',
                type: 'vector',
                url: sunExposureFile,
                format: 'geojson',
                style: {
                  property: 'exposure_value',
                  type: 'categorical',
                  stops: exposureCategories.map((cat, i) => [
                    5 - i, // Values are 5 to 1
                    cat.color
                  ])
                }
              }
            ],
            jobId: parameters.jobId || analysisId,
            projectId: parameters.projectId
          };
          
          logger.info('Sun exposure analysis completed successfully:', result.id);
          resolve(result);
        } catch (parseError) {
          logger.error('Error parsing sun exposure analysis results:', parseError);
          reject(new Error(`Failed to parse sun exposure analysis results: ${parseError.message}`));
        }
      });
    });
  } catch (error) {
    logger.error('Sun exposure analysis error:', error);
    throw error;
  }
} 