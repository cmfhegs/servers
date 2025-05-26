/**
 * Soil Type Analysis Operation
 * 
 * This module implements soil type analysis operations using QGIS and soil databases.
 * It identifies and classifies soil types within the project area.
 */
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { SoilTypeParameters, SoilTypeResult, SoilTypeStatistics } from '../../../src/types/analysis';
import { processError, validateDEM, prepareOutputDirectory } from './utils';
import { logger } from '../logger';

/**
 * Execute soil type analysis using QGIS processing
 * 
 * @param parameters - Soil type analysis parameters
 * @returns Promise resolving to soil type analysis result
 */
export async function executeSoilTypeAnalysis(parameters: SoilTypeParameters): Promise<SoilTypeResult> {
  try {
    logger.info('Starting soil type analysis with parameters:', parameters);
    
    // Validate input parameters
    if (!parameters.demPath) {
      throw new Error('DEM path is required for soil type analysis');
    }
    
    if (!parameters.soilDatabase) {
      throw new Error('Soil database is required for soil type analysis');
    }
    
    // Validate DEM file
    await validateDEM(parameters.demPath);
    
    // Prepare output directory
    const outputDir = await prepareOutputDirectory(parameters.outputPath);
    
    // Generate unique ID for this analysis
    const analysisId = parameters.jobId || `soil-${uuidv4()}`;
    
    // Define output file paths
    const soilLayerFile = path.join(outputDir, `${analysisId}_soil_types.geojson`);
    const statsFile = path.join(outputDir, `${analysisId}_stats.json`);
    
    // Build Python script arguments
    const scriptArgs = [
      `--dem=${parameters.demPath}`,
      `--output=${soilLayerFile}`,
      `--database=${parameters.soilDatabase}`,
      `--stats=${statsFile}`,
    ];
    
    if (parameters.depthRange) {
      scriptArgs.push(`--depth-min=${parameters.depthRange[0]}`);
      scriptArgs.push(`--depth-max=${parameters.depthRange[1]}`);
    }
    
    if (parameters.properties && parameters.properties.length > 0) {
      scriptArgs.push(`--properties=${parameters.properties.join(',')}`);
    }
    
    // Execute Python script for soil type analysis
    const scriptPath = path.join(__dirname, '../../../qgis-docker/scripts/soil_type_analysis.py');
    const command = `python "${scriptPath}" ${scriptArgs.join(' ')}`;
    
    logger.debug('Executing command:', command);
    
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          logger.error('Soil type analysis execution error:', error);
          logger.error('STDERR:', stderr);
          return reject(processError(error, stderr));
        }
        
        logger.debug('STDOUT:', stdout);
        
        try {
          // Read results
          const soilData = fs.readFileSync(soilLayerFile, 'utf8');
          const soilGeoJSON = JSON.parse(soilData);
          
          // Read statistics
          const statsData = fs.readFileSync(statsFile, 'utf8');
          const stats: SoilTypeStatistics = JSON.parse(statsData);
          
          // Extract soil classes from the GeoJSON properties
          const soilClasses = [];
          const processedCodes = new Set();
          
          // Get unique soil classes from features
          if (soilGeoJSON && soilGeoJSON.features) {
            for (const feature of soilGeoJSON.features) {
              const properties = feature.properties || {};
              
              if (properties.soil_code && !processedCodes.has(properties.soil_code)) {
                processedCodes.add(properties.soil_code);
                
                soilClasses.push({
                  name: properties.soil_name || `Soil Type ${properties.soil_code}`,
                  code: properties.soil_code,
                  description: properties.description || '',
                  color: properties.color || `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
                  drainage: properties.drainage || '',
                  depth: properties.depth_cm ? parseFloat(properties.depth_cm) : undefined,
                  texture: properties.texture || ''
                });
              }
            }
          }
          
          // Create result object
          const result: SoilTypeResult = {
            id: analysisId,
            type: 'soil_type',
            analysisType: 'soil_type',
            timestamp: new Date().toISOString(),
            status: 'completed',
            parameters: parameters,
            metadata: {
              timestamp: new Date().toISOString(),
              duration: stats.processingTime || 0,
              processor: 'QGIS',
              version: '3.x',
              crs: soilGeoJSON.crs?.properties?.name || '',
              demFile: path.basename(parameters.demPath)
            },
            statistics: stats,
            soilClasses: soilClasses,
            soilLayer: soilGeoJSON,
            layers: [
              {
                id: `${analysisId}_soil_types`,
                name: 'Soil Types',
                type: 'vector',
                url: soilLayerFile,
                format: 'geojson',
                style: {
                  property: 'soil_code',
                  type: 'categorical',
                  categories: soilClasses.map(cls => ({
                    value: cls.code,
                    color: cls.color,
                    label: cls.name
                  }))
                }
              }
            ],
            jobId: parameters.jobId || analysisId,
            projectId: parameters.projectId
          };
          
          logger.info('Soil type analysis completed successfully:', result.id);
          resolve(result);
        } catch (parseError) {
          logger.error('Error parsing soil type analysis results:', parseError);
          reject(new Error(`Failed to parse soil type analysis results: ${parseError.message}`));
        }
      });
    });
  } catch (error) {
    logger.error('Soil type analysis error:', error);
    throw error;
  }
} 