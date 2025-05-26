/**
 * Flood Risk Analysis Operation
 * 
 * This module implements flood risk analysis operations using QGIS processing.
 * It identifies flood-prone areas based on topography, hydrology, and rainfall data.
 */
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { FloodRiskParameters, FloodRiskResult, FloodRiskStatistics } from '../../../src/types/analysis';
import { processError, validateDEM, prepareOutputDirectory } from './utils';
import { logger } from '../logger';

/**
 * Execute flood risk analysis using QGIS processing
 * 
 * @param parameters - Flood risk analysis parameters
 * @returns Promise resolving to flood risk analysis result
 */
export async function executeFloodRiskAnalysis(parameters: FloodRiskParameters): Promise<FloodRiskResult> {
  try {
    logger.info('Starting flood risk analysis with parameters:', parameters);
    
    // Validate input parameters
    if (!parameters.demPath) {
      throw new Error('DEM path is required for flood risk analysis');
    }
    
    // Validate DEM file
    await validateDEM(parameters.demPath);
    
    // Prepare output directory
    const outputDir = await prepareOutputDirectory(parameters.outputPath);
    
    // Generate unique ID for this analysis
    const analysisId = parameters.jobId || `flood-risk-${uuidv4()}`;
    
    // Define output file paths
    const floodRiskFile = path.join(outputDir, `${analysisId}_flood_risk.geojson`);
    const statsFile = path.join(outputDir, `${analysisId}_stats.json`);
    
    // Build Python script arguments
    const scriptArgs = [
      `--dem=${parameters.demPath}`,
      `--output=${floodRiskFile}`,
      `--stats=${statsFile}`,
    ];
    
    // Add optional parameters if provided
    if (parameters.rainfall !== undefined) {
      scriptArgs.push(`--rainfall=${parameters.rainfall}`);
    }
    
    if (parameters.rainfallIntensity !== undefined) {
      scriptArgs.push(`--rainfall-intensity=${parameters.rainfallIntensity}`);
    }
    
    if (parameters.returnPeriod !== undefined) {
      scriptArgs.push(`--return-period=${parameters.returnPeriod}`);
    }
    
    if (parameters.flowAccumulationThreshold !== undefined) {
      scriptArgs.push(`--flow-accumulation-threshold=${parameters.flowAccumulationThreshold}`);
    }
    
    if (parameters.streamNetwork) {
      scriptArgs.push(`--stream-network=${parameters.streamNetwork}`);
    }
    
    if (parameters.soilData) {
      scriptArgs.push(`--soil-data=${parameters.soilData}`);
    }
    
    if (parameters.historicalFloods) {
      scriptArgs.push(`--historical-floods=${parameters.historicalFloods}`);
    }
    
    if (parameters.withClimateProjections) {
      scriptArgs.push('--with-climate-projections');
    }
    
    // Execute Python script for flood risk analysis
    const scriptPath = path.join(__dirname, '../../../qgis-docker/scripts/flood_risk_analysis.py');
    const command = `python "${scriptPath}" ${scriptArgs.join(' ')}`;
    
    logger.debug('Executing command:', command);
    
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          logger.error('Flood risk analysis execution error:', error);
          logger.error('STDERR:', stderr);
          return reject(processError(error, stderr));
        }
        
        logger.debug('STDOUT:', stdout);
        
        try {
          // Read vector results
          const floodRiskData = fs.readFileSync(floodRiskFile, 'utf8');
          const floodRiskGeoJSON = JSON.parse(floodRiskData);
          
          // Read statistics
          const statsData = fs.readFileSync(statsFile, 'utf8');
          const stats: FloodRiskStatistics = JSON.parse(statsData);
          
          // Extract risk categories from the statistics
          const riskCategories = stats.floodRiskCategories || [];
          
          // Create result object
          const result: FloodRiskResult = {
            id: analysisId,
            type: 'flood_risk',
            analysisType: 'flood_risk',
            timestamp: new Date().toISOString(),
            status: 'completed',
            parameters: parameters,
            metadata: {
              timestamp: new Date().toISOString(),
              duration: stats.processingTime || 0,
              processor: 'QGIS',
              version: '3.x',
              crs: floodRiskGeoJSON.crs?.properties?.name || '',
              demFile: path.basename(parameters.demPath)
            },
            statistics: stats,
            floodRiskLayer: floodRiskGeoJSON,
            floodRiskCategories: riskCategories.map(cat => ({
              name: cat.name,
              description: cat.description,
              riskValue: cat.risk_value,
              color: cat.color,
              biomimicryStrategies: cat.biomimicry_strategies || []
            })),
            biomimicryInsights: stats.biomimicryInsights || [],
            layers: [
              {
                id: `${analysisId}_flood_risk`,
                name: 'Flood Risk',
                type: 'vector',
                url: floodRiskFile,
                format: 'geojson',
                style: {
                  property: 'risk_level',
                  type: 'categorical',
                  categories: riskCategories.map(cat => ({
                    value: cat.risk_value,
                    color: cat.color,
                    label: cat.name
                  }))
                },
                legend: riskCategories.map(cat => ({
                  color: cat.color,
                  label: cat.name,
                  value: [cat.risk_value, cat.risk_value]
                }))
              }
            ],
            jobId: parameters.jobId || analysisId,
            projectId: parameters.projectId
          };
          
          logger.info('Flood risk analysis completed successfully:', result.id);
          resolve(result);
        } catch (parseError) {
          logger.error('Error parsing flood risk analysis results:', parseError);
          reject(new Error(`Failed to parse flood risk analysis results: ${parseError.message}`));
        }
      });
    });
  } catch (error) {
    logger.error('Flood risk analysis error:', error);
    throw error;
  }
} 