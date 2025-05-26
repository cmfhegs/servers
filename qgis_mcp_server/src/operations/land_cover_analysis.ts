/**
 * Land Cover Analysis Operation
 * 
 * This module implements land cover analysis operations using QGIS and external land cover databases.
 * It identifies and classifies land cover types within the project area and provides statistics.
 */
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { LandCoverParameters, LandCoverResult, LandCoverStatistics } from '../../../src/types/analysis';
import { processError, validateDEM, prepareOutputDirectory } from './utils';
import { logger } from '../logger';

/**
 * Execute land cover analysis using QGIS processing
 * 
 * @param parameters - Land cover analysis parameters
 * @returns Promise resolving to land cover analysis result
 */
export async function executeLandCoverAnalysis(parameters: LandCoverParameters): Promise<LandCoverResult> {
  try {
    logger.info('Starting land cover analysis with parameters:', parameters);
    
    // Validate input parameters
    if (!parameters.demPath) {
      throw new Error('DEM path is required for land cover analysis');
    }
    
    if (!parameters.landCoverDatabase) {
      throw new Error('Land cover database is required for land cover analysis');
    }
    
    // Validate DEM file
    await validateDEM(parameters.demPath);
    
    // Prepare output directory
    const outputDir = await prepareOutputDirectory(parameters.outputPath);
    
    // Generate unique ID for this analysis
    const analysisId = parameters.jobId || `landcover-${uuidv4()}`;
    
    // Define output file paths
    const landCoverFile = path.join(outputDir, `${analysisId}_land_cover.geojson`);
    const statsFile = path.join(outputDir, `${analysisId}_stats.json`);
    const changeFile = parameters.includeChangeAnalysis 
      ? path.join(outputDir, `${analysisId}_change.geojson`) 
      : null;
    
    // Build Python script arguments
    const scriptArgs = [
      `--dem=${parameters.demPath}`,
      `--output=${landCoverFile}`,
      `--database=${parameters.landCoverDatabase}`,
      `--stats=${statsFile}`,
    ];
    
    if (parameters.referenceYear) {
      scriptArgs.push(`--year=${parameters.referenceYear}`);
    }
    
    if (parameters.includeChangeAnalysis && parameters.endYear) {
      scriptArgs.push('--include-change');
      scriptArgs.push(`--end-year=${parameters.endYear}`);
      
      if (changeFile) {
        scriptArgs.push(`--change-output=${changeFile}`);
      }
    }
    
    if (parameters.bufferDistance) {
      scriptArgs.push(`--buffer=${parameters.bufferDistance}`);
    }
    
    if (parameters.classFilter && parameters.classFilter.length > 0) {
      scriptArgs.push(`--class-filter=${parameters.classFilter.join(',')}`);
    }
    
    // Execute Python script for land cover analysis
    const scriptPath = path.join(__dirname, '../../../qgis-docker/scripts/land_cover_analysis.py');
    const command = `python "${scriptPath}" ${scriptArgs.join(' ')}`;
    
    logger.debug('Executing command:', command);
    
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          logger.error('Land cover analysis execution error:', error);
          logger.error('STDERR:', stderr);
          return reject(processError(error, stderr));
        }
        
        logger.debug('STDOUT:', stdout);
        
        try {
          // Read results
          const landCoverData = fs.readFileSync(landCoverFile, 'utf8');
          const landCoverGeoJSON = JSON.parse(landCoverData);
          
          // Read statistics
          const statsData = fs.readFileSync(statsFile, 'utf8');
          const stats: LandCoverStatistics = JSON.parse(statsData);
          
          // Read change data if available
          let changeGeoJSON = null;
          if (parameters.includeChangeAnalysis && changeFile && fs.existsSync(changeFile)) {
            const changeData = fs.readFileSync(changeFile, 'utf8');
            changeGeoJSON = JSON.parse(changeData);
          }
          
          // Extract land cover classes from the GeoJSON properties
          const landCoverClasses = [];
          const processedCodes = new Set();
          
          // Get unique land cover classes from features
          if (landCoverGeoJSON && landCoverGeoJSON.features) {
            for (const feature of landCoverGeoJSON.features) {
              const properties = feature.properties || {};
              
              if (properties.land_cover_code && !processedCodes.has(properties.land_cover_code)) {
                processedCodes.add(properties.land_cover_code);
                
                // Extract biomimicry strategies if available
                const biomimicryStrategies = properties.biomimicry_strategies ? 
                  properties.biomimicry_strategies.split(',').map(s => s.trim()) : 
                  undefined;
                
                landCoverClasses.push({
                  code: properties.land_cover_code,
                  name: properties.land_cover_name || `Type ${properties.land_cover_code}`,
                  description: properties.description || '',
                  color: properties.color || `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
                  ecologicalValue: properties.ecological_value !== undefined ? parseFloat(properties.ecological_value) : undefined,
                  permeability: properties.permeability !== undefined ? parseFloat(properties.permeability) : undefined,
                  biomimicryStrategies
                });
              }
            }
          }
          
          // Create result object
          const result: LandCoverResult = {
            id: analysisId,
            type: 'land_cover',
            analysisType: 'land_cover',
            timestamp: new Date().toISOString(),
            status: 'completed',
            parameters: parameters,
            metadata: {
              timestamp: new Date().toISOString(),
              duration: stats.processingTime || 0,
              processor: 'QGIS',
              version: '3.x',
              crs: landCoverGeoJSON.crs?.properties?.name || '',
              demFile: path.basename(parameters.demPath)
            },
            statistics: stats,
            landCoverClasses: landCoverClasses,
            landCoverLayer: landCoverGeoJSON,
            changeLayer: changeGeoJSON,
            layers: [
              {
                id: `${analysisId}_land_cover`,
                name: 'Land Cover',
                type: 'vector',
                url: landCoverFile,
                format: 'geojson',
                style: {
                  property: 'land_cover_code',
                  type: 'categorical',
                  categories: landCoverClasses.map(cls => ({
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
          
          // Add change layer if available
          if (changeGeoJSON && changeFile) {
            result.layers.push({
              id: `${analysisId}_change`,
              name: 'Land Cover Change',
              type: 'vector',
              url: changeFile,
              format: 'geojson',
              style: {
                property: 'change_type',
                type: 'categorical',
                categories: [
                  { value: 'gain', color: '#33a02c', label: 'Gain' },
                  { value: 'loss', color: '#e31a1c', label: 'Loss' },
                  { value: 'change', color: '#ff7f00', label: 'Change' },
                  { value: 'stable', color: '#b2b2b2', label: 'Stable' }
                ]
              }
            });
          }
          
          logger.info('Land cover analysis completed successfully:', result.id);
          resolve(result);
        } catch (parseError) {
          logger.error('Error parsing land cover analysis results:', parseError);
          reject(new Error(`Failed to parse land cover analysis results: ${parseError.message}`));
        }
      });
    });
  } catch (error) {
    logger.error('Land cover analysis error:', error);
    throw error;
  }
} 