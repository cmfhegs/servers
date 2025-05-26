/**
 * Drainage Pattern Analysis Operation
 * 
 * This module implements drainage pattern analysis operations for QGIS.
 * It identifies drainage networks, flow paths, and catchment areas across a landscape.
 */
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { BaseAnalysisResult, AnalysisMetadata } from '../../../src/types/analysis';
import { processError, validateDEM, prepareOutputDirectory } from './utils';
import { logger } from '../logger';

/**
 * Parameters for drainage pattern analysis
 */
interface DrainagePatternParameters {
  type?: 'drainage_pattern';
  demPath: string;
  outputPath?: string;
  projectId: string;
  jobId?: string;
  flowAccumulationThreshold?: number;
  streamOrderMethod?: string;
  includeCatchments?: boolean;
  fillSinks?: boolean;
  resolution?: string | number;
}

/**
 * Drainage category
 */
interface DrainageCategory {
  name: string;
  description: string;
  value: number;
  color: string;
  biomimicry_strategies: string[];
}

/**
 * Statistics for drainage pattern analysis
 */
interface DrainagePatternStatistics {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  drainageDistribution: Record<string, number>;
  areaByCategory: Record<string, number>;
  totalAreaHectares: number;
  elevationRange: [number, number];
  drainageDensity: number;
  patternType: string;
  patternDescription: string;
  patternFeatures: string;
  biomimicryInsights: string[];
  drainageCategories: DrainageCategory[];
  histogram: Array<{
    range: [number, number];
    label: string;
    count: number;
    area: number;
    percentage: number;
  }>;
  maxFlowAccumulation: number;
  meanFlowAccumulation: number;
  processingTime: number;
}

/**
 * Result for drainage pattern analysis
 */
interface DrainagePatternResult extends BaseAnalysisResult {
  type: 'drainage_pattern';
  analysisType: 'drainage_pattern';
  parameters: DrainagePatternParameters;
  drainageLayer: GeoJSON.FeatureCollection;
  flowAccumulation?: GeoJSON.FeatureCollection;
  catchmentsLayer?: GeoJSON.FeatureCollection;
  drainageCategories: DrainageCategory[];
  statistics: DrainagePatternStatistics;
  biomimicryInsights: string[];
  patternType: string;
}

/**
 * Execute drainage pattern analysis using QGIS processing
 * 
 * @param parameters - Drainage pattern analysis parameters
 * @returns Promise resolving to drainage pattern analysis result
 */
export async function executeDrainagePatternAnalysis(
  parameters: DrainagePatternParameters
): Promise<DrainagePatternResult> {
  try {
    logger.info('Starting drainage pattern analysis with parameters:', parameters);
    
    // Validate input parameters
    if (!parameters.demPath) {
      throw new Error('DEM path is required for drainage pattern analysis');
    }
    
    // Validate DEM file
    await validateDEM(parameters.demPath);
    
    // Prepare output directory
    const outputDir = await prepareOutputDirectory(parameters.outputPath);
    
    // Generate unique ID for this analysis
    const analysisId = parameters.jobId || `drainage-pattern-${uuidv4()}`;
    
    // Define output file paths
    const drainageFile = path.join(outputDir, `${analysisId}_drainage.geojson`);
    const statsFile = path.join(outputDir, `${analysisId}_stats.json`);
    const flowAccFile = path.join(outputDir, `${analysisId}_flow_acc.tif`);
    
    // Build Python script arguments
    const scriptArgs = [
      `--dem=${parameters.demPath}`,
      `--output=${drainageFile}`,
      `--stats=${statsFile}`
    ];
    
    // Add optional parameters if provided
    if (parameters.flowAccumulationThreshold) {
      scriptArgs.push(`--flow-accumulation-threshold=${parameters.flowAccumulationThreshold}`);
    }
    
    if (parameters.streamOrderMethod) {
      scriptArgs.push(`--stream-order-method=${parameters.streamOrderMethod}`);
    }
    
    if (parameters.includeCatchments) {
      scriptArgs.push('--include-catchments');
    }
    
    if (parameters.fillSinks === false) {
      // Only add if explicitly set to false, since true is default
      scriptArgs.push('--no-fill-sinks');
    }
    
    // Execute Python script for drainage pattern analysis
    const scriptPath = path.join(__dirname, '../../../qgis-docker/scripts/drainage_pattern_analysis.py');
    const command = `python "${scriptPath}" ${scriptArgs.join(' ')}`;
    
    logger.debug('Executing command:', command);
    
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          logger.error('Drainage pattern analysis execution error:', error);
          logger.error('STDERR:', stderr);
          return reject(processError(error, stderr));
        }
        
        logger.debug('STDOUT:', stdout);
        
        try {
          // Read vector results
          const vectorData = fs.readFileSync(drainageFile, 'utf8');
          const vectorGeoJSON = JSON.parse(vectorData);
          
          // Read statistics
          const statsData = fs.readFileSync(statsFile, 'utf8');
          const stats: DrainagePatternStatistics = JSON.parse(statsData);
          
          // Create default categories if not provided in stats
          const drainageCategories = stats.drainageCategories || [
            {
              name: 'Main Channels',
              description: 'Primary drainage pathways with highest flow accumulation',
              value: 5,
              color: '#0000FF',  // Blue
              biomimicry_strategies: [
                'Design channels with natural meandering patterns to slow water flow',
                'Implement riffle-pool sequences inspired by river morphology',
                'Create bioswales that mimic riparian vegetation patterns'
              ]
            },
            {
              name: 'Secondary Channels',
              description: 'Branch drainage pathways with moderate flow accumulation',
              value: 4,
              color: '#4D4DFF',  // Lighter blue
              biomimicry_strategies: [
                'Incorporate step-pool systems inspired by mountain streams',
                'Design distributary channels based on delta formations',
                'Use directional infiltration strategies based on tributary systems'
              ]
            },
            {
              name: 'Minor Tributaries',
              description: 'Small drainage pathways with lower flow accumulation',
              value: 3,
              color: '#7A7AFF',  // Very light blue
              biomimicry_strategies: [
                'Create microcatchments inspired by desert drainage networks',
                'Design ephemeral water features that mimic seasonal streams',
                'Implement small-scale rainwater harvesting based on natural catchments'
              ]
            },
            {
              name: 'Flow Accumulation Areas',
              description: 'Areas with notable water accumulation not forming defined channels',
              value: 2,
              color: '#ADD8E6',  // Light blue
              biomimicry_strategies: [
                'Design detention areas inspired by natural depressions',
                'Create water spreading systems based on alluvial fans',
                'Implement permeable surfaces that mimic natural infiltration zones'
              ]
            },
            {
              name: 'Catchment Areas',
              description: 'Broader areas contributing water to the drainage system',
              value: 1,
              color: '#E6F7FF',  // Very pale blue
              biomimicry_strategies: [
                'Design vegetated slopes based on natural watershed patterns',
                'Implement contour-based water harvesting inspired by hillside hydrology',
                'Create living roofs that mimic natural catchment processes'
              ]
            }
          ];
          
          // Create result object
          const result: DrainagePatternResult = {
            id: analysisId,
            type: 'drainage_pattern',
            analysisType: 'drainage_pattern',
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
            drainageLayer: vectorGeoJSON,
            drainageCategories,
            biomimicryInsights: stats.biomimicryInsights || [
              'Design water management systems based on natural drainage patterns found in the landscape',
              'Create water features that mimic the site\'s existing drainage hierarchy',
              'Implement sustainable drainage solutions inspired by natural water flow processes',
              'Use the identified drainage pattern type as a guide for site-responsive water design'
            ],
            patternType: stats.patternType || 'dendritic',
            layers: [
              {
                id: `${analysisId}_drainage`,
                name: 'Drainage Pattern',
                type: 'vector',
                url: drainageFile,
                format: 'geojson',
                style: {
                  property: 'drainage_value',
                  type: 'categorical',
                  stops: drainageCategories.map(cat => [
                    cat.value,
                    cat.color
                  ])
                }
              },
              {
                id: `${analysisId}_flow_acc`,
                name: 'Flow Accumulation',
                type: 'raster',
                url: flowAccFile,
                format: 'raster'
              }
            ],
            jobId: parameters.jobId || analysisId,
            projectId: parameters.projectId
          };
          
          logger.info('Drainage pattern analysis completed successfully:', result.id);
          resolve(result);
        } catch (parseError) {
          logger.error('Error parsing drainage pattern analysis results:', parseError);
          reject(new Error(`Failed to parse drainage pattern analysis results: ${parseError.message}`));
        }
      });
    });
  } catch (error) {
    logger.error('Drainage pattern analysis error:', error);
    throw error;
  }
} 