/**
 * Habitat Connectivity Analysis Operation
 * 
 * This module implements habitat connectivity analysis operations for QGIS.
 * It identifies potential wildlife corridors and barriers based on landscape ecology principles.
 */
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { BaseAnalysisResult, AnalysisMetadata } from '../../../src/types/analysis';
import { processError, validateDEM, prepareOutputDirectory } from './utils';
import { logger } from '../logger';

/**
 * Parameters for habitat connectivity analysis
 */
interface HabitatConnectivityParameters {
  type?: 'habitat_connectivity';
  demPath: string;
  outputPath?: string;
  projectId: string;
  jobId?: string;
  landCoverPath?: string;
  habitatAreasPath?: string;
  targetSpecies?: string;
  maxCostDistance?: number;
  corridorWidth?: number;
  resolution?: string | number;
}

/**
 * Habitat quality category
 */
interface HabitatCategory {
  name: string;
  description: string;
  value: number;
  color: string;
  biomimicryStrategies: string[];
}

/**
 * Statistics for habitat connectivity analysis
 */
interface HabitatConnectivityStatistics {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  connectedAreaPercentage: number;
  totalConnectivityIndex: number;
  isolatedPatchCount: number;
  connectedPatchCount: number;
  corridorAreaHa: number;
  coreAreaHa: number;
  averageCorridorWidth: number;
  connectivityByType: Record<string, number>;
  biomimicryInsights: string[];
  habitatCategories: HabitatCategory[];
  histogram: Array<{
    range: [number, number];
    count: number;
    percentage: number;
  }>;
}

/**
 * Result for habitat connectivity analysis
 */
interface HabitatConnectivityResult extends BaseAnalysisResult {
  type: 'habitat_connectivity';
  analysisType: 'habitat_connectivity';
  parameters: HabitatConnectivityParameters;
  connectivityLayer: GeoJSON.FeatureCollection;
  habitatCategoriesLayer?: GeoJSON.FeatureCollection;
  connectivityCategories: HabitatCategory[];
  statistics: HabitatConnectivityStatistics;
  biomimicryInsights: string[];
  targetSpecies: string;
}

/**
 * Execute habitat connectivity analysis using QGIS processing
 * 
 * @param parameters - Habitat connectivity analysis parameters
 * @returns Promise resolving to habitat connectivity analysis result
 */
export async function executeHabitatConnectivityAnalysis(
  parameters: HabitatConnectivityParameters
): Promise<HabitatConnectivityResult> {
  try {
    logger.info('Starting habitat connectivity analysis with parameters:', parameters);
    
    // Validate input parameters
    if (!parameters.demPath) {
      throw new Error('DEM path is required for habitat connectivity analysis');
    }
    
    // Validate DEM file
    await validateDEM(parameters.demPath);
    
    // Prepare output directory
    const outputDir = await prepareOutputDirectory(parameters.outputPath);
    
    // Generate unique ID for this analysis
    const analysisId = parameters.jobId || `habitat-connectivity-${uuidv4()}`;
    
    // Define output file paths
    const connectivityFile = path.join(outputDir, `${analysisId}_connectivity.geojson`);
    const statsFile = path.join(outputDir, `${analysisId}_stats.json`);
    const resistanceFile = path.join(outputDir, `${analysisId}_resistance.tif`);
    
    // Build Python script arguments
    const scriptArgs = [
      `--dem=${parameters.demPath}`,
      `--output=${connectivityFile}`,
      `--stats=${statsFile}`,
      `--resistance-output=${resistanceFile}`
    ];
    
    // Add optional parameters if provided
    if (parameters.landCoverPath) {
      scriptArgs.push(`--land-cover=${parameters.landCoverPath}`);
    }
    
    if (parameters.habitatAreasPath) {
      scriptArgs.push(`--habitat-areas=${parameters.habitatAreasPath}`);
    }
    
    if (parameters.targetSpecies) {
      scriptArgs.push(`--target-species=${parameters.targetSpecies}`);
    }
    
    if (parameters.maxCostDistance) {
      scriptArgs.push(`--max-cost-distance=${parameters.maxCostDistance}`);
    }
    
    if (parameters.corridorWidth) {
      scriptArgs.push(`--corridor-width=${parameters.corridorWidth}`);
    }
    
    // Execute Python script for habitat connectivity analysis
    const scriptPath = path.join(__dirname, '../../../qgis-docker/scripts/habitat_connectivity_analysis.py');
    const command = `python "${scriptPath}" ${scriptArgs.join(' ')}`;
    
    logger.debug('Executing command:', command);
    
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          logger.error('Habitat connectivity analysis execution error:', error);
          logger.error('STDERR:', stderr);
          return reject(processError(error, stderr));
        }
        
        logger.debug('STDOUT:', stdout);
        
        try {
          // Read vector results
          const vectorData = fs.readFileSync(connectivityFile, 'utf8');
          const vectorGeoJSON = JSON.parse(vectorData);
          
          // Read statistics
          const statsData = fs.readFileSync(statsFile, 'utf8');
          const stats: HabitatConnectivityStatistics = JSON.parse(statsData);
          
          // Create default categories if not provided in stats
          const connectivityCategories = stats.habitatCategories || [
            {
              name: 'Core Habitat',
              description: 'High-quality habitat areas essential for species survival',
              value: 5,
              color: '#1a9641',
              biomimicryStrategies: [
                'Preserve and enhance existing ecosystem functions',
                'Mimic keystone species and their ecological roles',
                'Replicate natural habitat complexity and layering'
              ]
            },
            {
              name: 'High Connectivity',
              description: 'Areas providing strong movement corridors between habitats',
              value: 4,
              color: '#a6d96a',
              biomimicryStrategies: [
                'Design corridors based on animal movement patterns',
                'Create stepping stone habitats inspired by natural archipelagos',
                'Implement multi-level connectivity solutions like forest canopy bridges'
              ]
            },
            {
              name: 'Moderate Connectivity',
              description: 'Areas with some value for wildlife movement',
              value: 3,
              color: '#ffffbf',
              biomimicryStrategies: [
                'Restore native plant communities to improve permeability',
                'Design diffuse edge conditions inspired by natural ecotones',
                'Incorporate wildlife-friendly infrastructure elements'
              ]
            },
            {
              name: 'Low Connectivity',
              description: 'Areas with limited habitat value but still permeable',
              value: 2,
              color: '#fdae61',
              biomimicryStrategies: [
                'Implement green infrastructure to increase permeability',
                'Create microhabitat features to serve as refuge points',
                'Reduce edge effects through transitional planting designs'
              ]
            },
            {
              name: 'Barrier/Matrix',
              description: 'Areas with significant barriers to wildlife movement',
              value: 1,
              color: '#d7191c',
              biomimicryStrategies: [
                'Design wildlife crossing structures based on animal locomotion',
                'Implement barrier mitigation strategies inspired by natural solutions',
                'Create habitat islands within developed areas'
              ]
            }
          ];
          
          // Create result object
          const result: HabitatConnectivityResult = {
            id: analysisId,
            type: 'habitat_connectivity',
            analysisType: 'habitat_connectivity',
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
            connectivityLayer: vectorGeoJSON,
            connectivityCategories,
            biomimicryInsights: stats.biomimicryInsights || [
              'Habitat connectivity patterns in nature can inform landscape design for both human and wildlife movement',
              'Edge conditions in natural habitats demonstrate gradual transitions that can be applied to built environment interfaces',
              'Natural corridors exhibit redundancy and multiple pathway options, increasing resilience',
              'Keystone species influence ecosystem connectivity through their movement patterns and behaviors'
            ],
            targetSpecies: parameters.targetSpecies || 'general',
            layers: [
              {
                id: `${analysisId}_connectivity`,
                name: 'Habitat Connectivity',
                type: 'vector',
                url: connectivityFile,
                format: 'geojson',
                style: {
                  property: 'connectivity',
                  type: 'categorical',
                  stops: connectivityCategories.map(cat => [
                    cat.value,
                    cat.color
                  ])
                }
              },
              {
                id: `${analysisId}_resistance`,
                name: 'Resistance Surface',
                type: 'raster',
                url: resistanceFile,
                format: 'raster'
              }
            ],
            jobId: parameters.jobId || analysisId,
            projectId: parameters.projectId
          };
          
          logger.info('Habitat connectivity analysis completed successfully:', result.id);
          resolve(result);
        } catch (parseError) {
          logger.error('Error parsing habitat connectivity analysis results:', parseError);
          reject(new Error(`Failed to parse habitat connectivity analysis results: ${parseError.message}`));
        }
      });
    });
  } catch (error) {
    logger.error('Habitat connectivity analysis error:', error);
    throw error;
  }
} 