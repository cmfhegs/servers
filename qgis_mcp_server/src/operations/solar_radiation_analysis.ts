/**
 * Solar Radiation Analysis Operation
 * 
 * This module implements solar radiation analysis operations using QGIS processing.
 * It calculates solar radiation for different time periods, taking into account
 * terrain shadowing, sky conditions, and biomimicry optimization.
 */
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { SolarRadiationParameters, SolarRadiationResult, SolarRadiationStatistics } from '../../../src/types/analysis';
import { processError, validateDEM, prepareOutputDirectory } from './utils';
import { logger } from '../logger';

/**
 * Execute solar radiation analysis using QGIS processing
 * 
 * @param parameters - Solar radiation analysis parameters
 * @returns Promise resolving to solar radiation analysis result
 */
export async function executeSolarRadiationAnalysis(parameters: SolarRadiationParameters): Promise<SolarRadiationResult> {
  try {
    logger.info('Starting solar radiation analysis with parameters:', parameters);
    
    // Validate input parameters
    if (!parameters.demPath) {
      throw new Error('DEM path is required for solar radiation analysis');
    }
    
    // Set defaults for required parameters if not provided
    const calculationMode = parameters.calculationMode || 'day';
    const skyModel = parameters.skyModel || 'clear_sky';
    const includeShadowing = parameters.includeShadowing !== undefined ? parameters.includeShadowing : true;
    
    // Validate DEM file
    await validateDEM(parameters.demPath);
    
    // Prepare output directory
    const outputDir = await prepareOutputDirectory(parameters.outputPath);
    
    // Generate unique ID for this analysis
    const analysisId = parameters.jobId || `solar-${uuidv4()}`;
    
    // Define output file paths
    const radiationFile = path.join(outputDir, `${analysisId}_radiation.tif`);
    const radiationVectorFile = path.join(outputDir, `${analysisId}_radiation.geojson`);
    const statsFile = path.join(outputDir, `${analysisId}_stats.json`);
    const temporalFile = path.join(outputDir, `${analysisId}_temporal.json`);
    
    // Build Python script arguments
    const scriptArgs = [
      `--dem=${parameters.demPath}`,
      `--output=${radiationFile}`,
      `--vector-output=${radiationVectorFile}`,
      `--calculation-mode=${calculationMode}`,
      `--sky-model=${skyModel}`,
      `--stats=${statsFile}`,
      `--temporal-data=${temporalFile}`
    ];
    
    // Add optional parameters
    if (parameters.dayOfYear) {
      scriptArgs.push(`--day-of-year=${parameters.dayOfYear}`);
    } else if (parameters.month && parameters.dayOfMonth) {
      scriptArgs.push(`--month=${parameters.month}`);
      scriptArgs.push(`--day=${parameters.dayOfMonth}`);
    }
    
    if (parameters.startHour !== undefined) {
      scriptArgs.push(`--start-hour=${parameters.startHour}`);
    }
    
    if (parameters.endHour !== undefined) {
      scriptArgs.push(`--end-hour=${parameters.endHour}`);
    }
    
    if (parameters.timeInterval) {
      scriptArgs.push(`--time-interval=${parameters.timeInterval}`);
    }
    
    if (includeShadowing) {
      scriptArgs.push('--with-shadowing');
    }
    
    if (parameters.diffuseProportion !== undefined) {
      scriptArgs.push(`--diffuse-proportion=${parameters.diffuseProportion}`);
    }
    
    if (parameters.albedo !== undefined) {
      scriptArgs.push(`--albedo=${parameters.albedo}`);
    }
    
    if (parameters.transmissivity !== undefined) {
      scriptArgs.push(`--transmissivity=${parameters.transmissivity}`);
    }
    
    if (parameters.clearSkyIndex !== undefined) {
      scriptArgs.push(`--clear-sky-index=${parameters.clearSkyIndex}`);
    }
    
    if (parameters.biomimicryOptimize) {
      scriptArgs.push('--biomimicry-optimize');
    }
    
    // Execute Python script for solar radiation analysis
    const scriptPath = path.join(__dirname, '../../../qgis-docker/scripts/solar_radiation_analysis.py');
    const command = `python "${scriptPath}" ${scriptArgs.join(' ')}`;
    
    logger.debug('Executing command:', command);
    
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          logger.error('Solar radiation analysis execution error:', error);
          logger.error('STDERR:', stderr);
          return reject(processError(error, stderr));
        }
        
        logger.debug('STDOUT:', stdout);
        
        try {
          // Read vector results
          const radiationData = fs.readFileSync(radiationVectorFile, 'utf8');
          const radiationGeoJSON = JSON.parse(radiationData);
          
          // Read statistics
          const statsData = fs.readFileSync(statsFile, 'utf8');
          const stats: SolarRadiationStatistics = JSON.parse(statsData);
          
          // Read temporal data if available
          let temporalData = undefined;
          if (fs.existsSync(temporalFile)) {
            const temporalDataStr = fs.readFileSync(temporalFile, 'utf8');
            temporalData = JSON.parse(temporalDataStr);
          }
          
          // Extract radiation categories from the results
          const radiationCategories = [];
          const processedCategories = new Set();
          
          // Define standard radiation categories based on analysis results
          const maxRadiation = stats.max;
          const radiationRange = stats.max - stats.min;
          const categoryCount = 5;
          const interval = radiationRange / categoryCount;
          
          for (let i = 0; i < categoryCount; i++) {
            const min = stats.min + (i * interval);
            const max = stats.min + ((i + 1) * interval);
            
            // Calculate suitability for solar applications (higher = better)
            const suitability = Math.round(((min + max) / 2 - stats.min) / radiationRange * 100);
            
            // Define biomimicry strategies based on radiation level
            let biomimicryStrategies: string[] | undefined = undefined;
            
            if (suitability > 80) {
              biomimicryStrategies = [
                'Solar energy harvesting (Sunflower pattern)',
                'Thermal mass storage (Desert organisms)',
                'Photosynthetic system inspiration'
              ];
            } else if (suitability > 60) {
              biomimicryStrategies = [
                'Solar tracking systems (Heliotropism)',
                'Selective filtering (Leaf structure)'
              ];
            } else if (suitability > 40) {
              biomimicryStrategies = [
                'Light reflection/refraction (Marine organisms)',
                'Adaptive shading (Plant canopies)'
              ];
            } else if (suitability > 20) {
              biomimicryStrategies = [
                'Thermoregulation (Forest floor adaptation)',
                'Energy efficiency in low light (Understory plants)'
              ];
            } else {
              biomimicryStrategies = [
                'Heat conservation (Arctic organisms)',
                'Light amplification strategies (Deep forest plants)'
              ];
            }
            
            // Define category color using a color scale from blue to red
            const hue = Math.round(240 - (i * (240 / (categoryCount - 1))));
            const color = `hsl(${hue}, 100%, 50%)`;
            
            radiationCategories.push({
              min,
              max,
              name: i === 0 ? 'Very Low' : 
                    i === 1 ? 'Low' : 
                    i === 2 ? 'Medium' : 
                    i === 3 ? 'High' : 'Very High',
              color,
              suitability,
              biomimicryStrategies
            });
          }
          
          // Derive biomimicry insights from the analysis results
          const biomimicryInsights = deriveBiomimicryInsights(stats, parameters);
          
          // Create result object
          const result: SolarRadiationResult = {
            id: analysisId,
            type: 'solar_radiation',
            analysisType: 'solar_radiation',
            timestamp: new Date().toISOString(),
            status: 'completed',
            parameters: parameters,
            metadata: {
              timestamp: new Date().toISOString(),
              duration: stats.processingTime || 0,
              processor: 'QGIS',
              version: '3.x',
              crs: radiationGeoJSON.crs?.properties?.name || '',
              demFile: path.basename(parameters.demPath)
            },
            statistics: stats,
            radiationCategories,
            radiationRaster: radiationFile,
            radiationLayer: radiationGeoJSON,
            temporalData,
            biomimicryInsights,
            layers: [
              {
                id: `${analysisId}_radiation`,
                name: 'Solar Radiation',
                type: 'vector',
                url: radiationVectorFile,
                format: 'geojson',
                style: {
                  property: 'radiation',
                  type: 'interpolate',
                  interpolateProperty: 'radiation',
                  stops: radiationCategories.map(cat => [
                    (cat.min + cat.max) / 2,
                    cat.color
                  ])
                }
              }
            ],
            jobId: parameters.jobId || analysisId,
            projectId: parameters.projectId
          };
          
          logger.info('Solar radiation analysis completed successfully:', result.id);
          resolve(result);
        } catch (parseError) {
          logger.error('Error parsing solar radiation analysis results:', parseError);
          reject(new Error(`Failed to parse solar radiation analysis results: ${parseError.message}`));
        }
      });
    });
  } catch (error) {
    logger.error('Solar radiation analysis error:', error);
    throw error;
  }
}

/**
 * Derive biomimicry insights from solar radiation analysis results
 * 
 * @param stats - Solar radiation statistics
 * @param parameters - Analysis parameters
 * @returns Array of biomimicry insights
 */
function deriveBiomimicryInsights(
  stats: SolarRadiationStatistics,
  parameters: SolarRadiationParameters
): string[] {
  const insights: string[] = [];
  
  // High solar radiation areas
  if (stats.highExposurePercentage > 50) {
    insights.push(
      'High solar exposure areas present opportunities for biomimetic solar harvesting ' +
      'strategies inspired by heliotropic plants like sunflowers that track the sun.'
    );
  }
  
  // Areas with variable radiation
  if (stats.stdDev / stats.mean > 0.3) {
    insights.push(
      'Significant variation in solar radiation across the site suggests potential for ' +
      'adaptive shading systems inspired by leaf canopy structures in forests.'
    );
  }
  
  // Seasonal variations (if yearly analysis)
  if (parameters.calculationMode === 'year' && stats.monthlyDistribution) {
    insights.push(
      'Seasonal radiation patterns indicate opportunities for thermoregulation ' +
      'strategies inspired by organisms that adapt to changing conditions, such as ' +
      'deciduous trees that modify their canopy throughout the year.'
    );
  }
  
  // Daily variations (if daily analysis with hourly data)
  if (parameters.calculationMode === 'day' && stats.hourlyDistribution) {
    insights.push(
      'Diurnal radiation patterns suggest potential for dynamic facade systems ' +
      'inspired by flowers that open and close in response to light levels.'
    );
  }
  
  // If high diffuse component
  if (stats.diffuseRadiation > stats.directRadiation * 0.7) {
    insights.push(
      'High diffuse radiation component suggests adapting strategies from forest ' +
      'understory plants that efficiently capture scattered light.'
    );
  }
  
  // Add general insight about thermal management
  insights.push(
    'Consider thermal mass distribution inspired by desert organisms that ' +
    'moderate temperature extremes through material properties and form.'
  );
  
  return insights;
} 