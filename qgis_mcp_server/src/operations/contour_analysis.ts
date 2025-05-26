/**
 * Contour Analysis Operation
 * 
 * This module implements contour line analysis operations for QGIS.
 * It generates contour lines at specified intervals based on the input DEM.
 */
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { ContourParameters, ContourResult, ContourStatistics } from '../../../src/types/analysis';
import { processError, validateDEM, prepareOutputDirectory } from './utils';
import { logger } from '../logger';

/**
 * Execute contour analysis using QGIS processing
 * 
 * @param parameters - Contour analysis parameters
 * @returns Promise resolving to contour analysis result
 */
export async function executeContourAnalysis(parameters: ContourParameters): Promise<ContourResult> {
  try {
    logger.info('Starting contour analysis with parameters:', parameters);
    
    // Validate input parameters
    if (!parameters.demPath) {
      throw new Error('DEM path is required for contour analysis');
    }
    
    if (!parameters.interval || parameters.interval <= 0) {
      throw new Error('Contour interval must be a positive number');
    }
    
    // Validate DEM file
    await validateDEM(parameters.demPath);
    
    // Prepare output directory
    const outputDir = await prepareOutputDirectory(parameters.outputPath);
    
    // Generate unique ID for this analysis
    const analysisId = parameters.jobId || `contour-${uuidv4()}`;
    
    // Define output file paths
    const contourFile = path.join(outputDir, `${analysisId}_contours.geojson`);
    const indexContourFile = parameters.generateIndex 
      ? path.join(outputDir, `${analysisId}_index_contours.geojson`) 
      : null;
    const statsFile = path.join(outputDir, `${analysisId}_stats.json`);
    
    // Build Python script arguments
    const scriptArgs = [
      `--dem=${parameters.demPath}`,
      `--output=${contourFile}`,
      `--interval=${parameters.interval}`,
    ];
    
    if (parameters.baseContour !== undefined) {
      scriptArgs.push(`--base=${parameters.baseContour}`);
    }
    
    if (parameters.minContour !== undefined) {
      scriptArgs.push(`--min=${parameters.minContour}`);
    }
    
    if (parameters.maxContour !== undefined) {
      scriptArgs.push(`--max=${parameters.maxContour}`);
    }
    
    if (parameters.generateIndex) {
      scriptArgs.push(`--index-output=${indexContourFile}`);
      
      if (parameters.indexInterval) {
        scriptArgs.push(`--index-interval=${parameters.indexInterval}`);
      }
    }
    
    if (parameters.smoothContours) {
      scriptArgs.push('--smooth');
      
      if (parameters.smoothingFactor) {
        scriptArgs.push(`--smoothing-factor=${parameters.smoothingFactor}`);
      }
    }
    
    scriptArgs.push(`--stats=${statsFile}`);
    
    // Execute Python script for contour analysis
    const scriptPath = path.join(__dirname, '../../../qgis-docker/scripts/contour_analysis.py');
    const command = `python "${scriptPath}" ${scriptArgs.join(' ')}`;
    
    logger.debug('Executing command:', command);
    
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          logger.error('Contour analysis execution error:', error);
          logger.error('STDERR:', stderr);
          return reject(processError(error, stderr));
        }
        
        logger.debug('STDOUT:', stdout);
        
        try {
          // Read results
          const contourData = fs.readFileSync(contourFile, 'utf8');
          const contourGeoJSON = JSON.parse(contourData);
          
          let indexContourGeoJSON = null;
          if (parameters.generateIndex && indexContourFile) {
            const indexData = fs.readFileSync(indexContourFile, 'utf8');
            indexContourGeoJSON = JSON.parse(indexData);
          }
          
          // Read statistics
          const statsData = fs.readFileSync(statsFile, 'utf8');
          const stats: ContourStatistics = JSON.parse(statsData);
          
          // Create result object
          const result: ContourResult = {
            id: analysisId,
            type: 'contour',
            analysisType: 'contour',
            timestamp: new Date().toISOString(),
            status: 'completed',
            parameters: parameters,
            metadata: {
              timestamp: new Date().toISOString(),
              duration: stats.processingTime || 0,
              processor: 'QGIS',
              version: '3.x',
              crs: contourGeoJSON.crs?.properties?.name || '',
              demFile: path.basename(parameters.demPath)
            },
            statistics: stats,
            contourLines: contourGeoJSON,
            indexContours: indexContourGeoJSON,
            layers: [
              {
                id: `${analysisId}_contours`,
                name: 'Contour Lines',
                type: 'vector',
                url: contourFile,
                format: 'geojson',
                style: {
                  color: '#996633',
                  weight: 1,
                  opacity: 0.8
                }
              }
            ],
            jobId: parameters.jobId || analysisId,
            projectId: parameters.projectId
          };
          
          // Add index contours layer if available
          if (indexContourGeoJSON && indexContourFile) {
            result.layers.push({
              id: `${analysisId}_index_contours`,
              name: 'Index Contours',
              type: 'vector',
              url: indexContourFile,
              format: 'geojson',
              style: {
                color: '#663300',
                weight: 2,
                opacity: 1
              }
            });
          }
          
          logger.info('Contour analysis completed successfully:', result.id);
          resolve(result);
        } catch (parseError) {
          logger.error('Error parsing contour analysis results:', parseError);
          reject(new Error(`Failed to parse contour analysis results: ${parseError.message}`));
        }
      });
    });
  } catch (error) {
    logger.error('Contour analysis error:', error);
    throw error;
  }
} 