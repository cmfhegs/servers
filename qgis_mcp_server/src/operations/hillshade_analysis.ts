/**
 * Hillshade Analysis Operation
 * 
 * This module implements hillshade analysis operations for QGIS.
 * It generates shaded relief based on sun position and terrain.
 */
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { HillshadeParameters, HillshadeResult, HillshadeStatistics } from '../../../src/types/analysis';
import { processError, validateDEM, prepareOutputDirectory } from './utils';
import { logger } from '../logger';

/**
 * Execute hillshade analysis using QGIS processing
 * 
 * @param parameters - Hillshade analysis parameters
 * @returns Promise resolving to hillshade analysis result
 */
export async function executeHillshadeAnalysis(parameters: HillshadeParameters): Promise<HillshadeResult> {
  try {
    logger.info('Starting hillshade analysis with parameters:', parameters);
    
    // Validate input parameters
    if (!parameters.demPath) {
      throw new Error('DEM path is required for hillshade analysis');
    }
    
    // Validate DEM file
    await validateDEM(parameters.demPath);
    
    // Prepare output directory
    const outputDir = await prepareOutputDirectory(parameters.outputPath);
    
    // Generate unique ID for this analysis
    const analysisId = parameters.jobId || `hillshade-${uuidv4()}`;
    
    // Define output file paths
    const hillshadeFile = path.join(outputDir, `${analysisId}_hillshade.tif`);
    const vectorFile = path.join(outputDir, `${analysisId}_hillshade.geojson`);
    const statsFile = path.join(outputDir, `${analysisId}_stats.json`);
    
    // Build Python script arguments
    const scriptArgs = [
      `--dem=${parameters.demPath}`,
      `--output=${hillshadeFile}`,
      `--vector-output=${vectorFile}`,
      `--stats=${statsFile}`,
    ];
    
    // Add optional parameters if provided
    if (parameters.altitude !== undefined) {
      scriptArgs.push(`--altitude=${parameters.altitude}`);
    }
    
    if (parameters.azimuth !== undefined) {
      scriptArgs.push(`--azimuth=${parameters.azimuth}`);
    }
    
    if (parameters.zFactor !== undefined) {
      scriptArgs.push(`--z-factor=${parameters.zFactor}`);
    }
    
    if (parameters.multidirectional) {
      scriptArgs.push('--multidirectional');
    }
    
    if (parameters.combined) {
      scriptArgs.push('--combined');
    }
    
    // Execute Python script for hillshade analysis
    const scriptPath = path.join(__dirname, '../../../qgis-docker/scripts/hillshade_analysis.py');
    const command = `python "${scriptPath}" ${scriptArgs.join(' ')}`;
    
    logger.debug('Executing command:', command);
    
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          logger.error('Hillshade analysis execution error:', error);
          logger.error('STDERR:', stderr);
          return reject(processError(error, stderr));
        }
        
        logger.debug('STDOUT:', stdout);
        
        try {
          // Read vector results if available
          const vectorData = fs.readFileSync(vectorFile, 'utf8');
          const vectorGeoJSON = JSON.parse(vectorData);
          
          // Read statistics
          const statsData = fs.readFileSync(statsFile, 'utf8');
          const stats: HillshadeStatistics = JSON.parse(statsData);
          
          // Create illumination categories based on the statistics
          const illuminationCategories = [];
          
          // Create standard categories for hillshade (0-255 range)
          const categories = [
            { min: 0, max: 50, name: 'Deep Shadow', color: '#000033' },
            { min: 50, max: 100, name: 'Shadow', color: '#000066' },
            { min: 100, max: 150, name: 'Moderate', color: '#3366CC' },
            { min: 150, max: 200, name: 'Illuminated', color: '#99CCFF' },
            { min: 200, max: 255, name: 'Bright', color: '#FFFFFF' }
          ];
          
          // Build the categories
          for (const cat of categories) {
            illuminationCategories.push({
              min: cat.min,
              max: cat.max,
              name: cat.name,
              color: cat.color,
              biomimicryInsights: [
                `${cat.name} areas can inform microclimate design strategies`,
                `${cat.name.toLowerCase()} patterns can guide building orientation and form`,
              ]
            });
          }
          
          // Create result object
          const result: HillshadeResult = {
            id: analysisId,
            type: 'hillshade',
            analysisType: 'hillshade',
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
            hillshadeRaster: hillshadeFile,
            hillshadeLayer: vectorGeoJSON,
            illuminationCategories,
            biomimicryInsights: stats.biomimicryInsights || [],
            layers: [
              {
                id: `${analysisId}_hillshade`,
                name: 'Hillshade',
                type: 'vector',
                url: vectorFile,
                format: 'geojson',
                style: {
                  property: 'shade',
                  type: 'step',
                  stops: illuminationCategories.map(cat => [
                    (cat.min + cat.max) / 2,
                    cat.color
                  ])
                }
              }
            ],
            jobId: parameters.jobId || analysisId,
            projectId: parameters.projectId
          };
          
          // Add a raster layer if generated
          result.layers.push({
            id: `${analysisId}_hillshade_raster`,
            name: 'Hillshade Raster',
            type: 'raster',
            url: hillshadeFile,
            format: 'raster'
          });
          
          logger.info('Hillshade analysis completed successfully:', result.id);
          resolve(result);
        } catch (parseError) {
          logger.error('Error parsing hillshade analysis results:', parseError);
          reject(new Error(`Failed to parse hillshade analysis results: ${parseError.message}`));
        }
      });
    });
  } catch (error) {
    logger.error('Hillshade analysis error:', error);
    throw error;
  }
} 