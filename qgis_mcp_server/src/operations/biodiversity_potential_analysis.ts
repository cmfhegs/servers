/**
 * Biodiversity Potential Analysis Operation
 * 
 * This module implements biodiversity potential analysis operations for QGIS.
 * It analyzes a landscape's potential to support biodiversity with biomimicry insights.
 */
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { BaseAnalysisResult, AnalysisMetadata } from '../../../src/types/analysis';
import { processError, validateDEM, prepareOutputDirectory } from './utils';
import { logger } from '../logger';

/**
 * Parameters for biodiversity potential analysis
 */
interface BiodiversityPotentialParameters {
  type?: 'biodiversity_potential';
  demPath: string;
  outputPath?: string;
  projectId: string;
  jobId?: string;
  landCoverPath?: string;
  distanceToWater?: boolean;
  edgeDensity?: boolean;
  elevationRange?: boolean;
  habitatDiversityWeight?: number;
  connectivityWeight?: number;
  elevationWeight?: number;
  waterWeight?: number;
  resolution?: string | number;
}

/**
 * Biodiversity category
 */
interface BiodiversityCategory {
  name: string;
  description: string;
  value: number;
  color: string;
  biomimicry_strategies: string[];
}

/**
 * Biodiversity metrics data
 */
interface BiodiversityMetrics {
  shannonDiversity: number;
  simpsonDiversity: number;
  richness: number;
  evenness: number;
}

/**
 * Statistics for biodiversity potential analysis
 */
interface BiodiversityPotentialStatistics {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  biodiversityDistribution: Record<string, number>;
  areaByCategory: Record<string, number>;
  totalAreaHectares: number;
  elevationRange: [number, number];
  biomimicryInsights: string[];
  biodiversityCategories: BiodiversityCategory[];
  biodiversityMetrics: BiodiversityMetrics;
  histogram: Array<{
    range: [number, number];
    label: string;
    count: number;
    area: number;
    percentage: number;
  }>;
}

/**
 * Result for biodiversity potential analysis
 */
interface BiodiversityPotentialResult extends BaseAnalysisResult {
  type: 'biodiversity_potential';
  analysisType: 'biodiversity_potential';
  parameters: BiodiversityPotentialParameters;
  biodiversityLayer: GeoJSON.FeatureCollection;
  biodiversityPotentialRaster?: string;
  biodiversityCategories: BiodiversityCategory[];
  statistics: BiodiversityPotentialStatistics;
  biomimicryInsights: string[];
  biodiversityMetrics: BiodiversityMetrics;
}

/**
 * Execute biodiversity potential analysis using QGIS processing
 * 
 * @param parameters - Biodiversity potential analysis parameters
 * @returns Promise resolving to biodiversity potential analysis result
 */
export async function executeBiodiversityPotentialAnalysis(
  parameters: BiodiversityPotentialParameters
): Promise<BiodiversityPotentialResult> {
  try {
    logger.info('Starting biodiversity potential analysis with parameters:', parameters);
    
    // Validate input parameters
    if (!parameters.demPath) {
      throw new Error('DEM path is required for biodiversity potential analysis');
    }
    
    // Validate DEM file
    await validateDEM(parameters.demPath);
    
    // Prepare output directory
    const outputDir = await prepareOutputDirectory(parameters.outputPath);
    
    // Generate unique ID for this analysis
    const analysisId = parameters.jobId || `biodiversity-${uuidv4()}`;
    
    // Define output file paths
    const biodiversityFile = path.join(outputDir, `${analysisId}_biodiversity.geojson`);
    const statsFile = path.join(outputDir, `${analysisId}_stats.json`);
    
    // Build Python script arguments
    const scriptArgs = [
      `--dem=${parameters.demPath}`,
      `--output=${biodiversityFile}`,
      `--stats=${statsFile}`
    ];
    
    // Add optional parameters if provided
    if (parameters.landCoverPath) {
      scriptArgs.push(`--land-cover=${parameters.landCoverPath}`);
    }
    
    if (parameters.distanceToWater) {
      scriptArgs.push('--distance-to-water');
    }
    
    if (parameters.edgeDensity) {
      scriptArgs.push('--edge-density');
    }
    
    if (parameters.elevationRange) {
      scriptArgs.push('--elevation-range');
    }
    
    if (parameters.habitatDiversityWeight !== undefined) {
      scriptArgs.push(`--habitat-diversity-weight=${parameters.habitatDiversityWeight}`);
    }
    
    if (parameters.connectivityWeight !== undefined) {
      scriptArgs.push(`--connectivity-weight=${parameters.connectivityWeight}`);
    }
    
    if (parameters.elevationWeight !== undefined) {
      scriptArgs.push(`--elevation-weight=${parameters.elevationWeight}`);
    }
    
    if (parameters.waterWeight !== undefined) {
      scriptArgs.push(`--water-weight=${parameters.waterWeight}`);
    }
    
    // Execute Python script for biodiversity potential analysis
    const scriptPath = path.join(__dirname, '../../../qgis-docker/scripts/biodiversity_potential_analysis.py');
    const command = `python "${scriptPath}" ${scriptArgs.join(' ')}`;
    
    logger.debug('Executing command:', command);
    
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          logger.error('Biodiversity potential analysis execution error:', error);
          logger.error('STDERR:', stderr);
          return reject(processError(error, stderr));
        }
        
        logger.debug('STDOUT:', stdout);
        
        try {
          // Read vector results
          const vectorData = fs.readFileSync(biodiversityFile, 'utf8');
          const vectorGeoJSON = JSON.parse(vectorData);
          
          // Read statistics
          const statsData = fs.readFileSync(statsFile, 'utf8');
          const stats: BiodiversityPotentialStatistics = JSON.parse(statsData);
          
          // Create result object
          const result: BiodiversityPotentialResult = {
            id: analysisId,
            type: 'biodiversity_potential',
            analysisType: 'biodiversity_potential',
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
            biodiversityLayer: vectorGeoJSON,
            biodiversityCategories: stats.biodiversityCategories,
            biomimicryInsights: stats.biomimicryInsights,
            biodiversityMetrics: stats.biodiversityMetrics,
            layers: [
              {
                id: `${analysisId}_biodiversity`,
                name: 'Biodiversity Potential',
                type: 'vector',
                url: biodiversityFile,
                format: 'geojson',
                style: {
                  property: 'potential_value',
                  type: 'categorical',
                  stops: stats.biodiversityCategories.map(cat => [
                    cat.value,
                    cat.color
                  ])
                }
              }
            ],
            jobId: parameters.jobId || analysisId,
            projectId: parameters.projectId
          };
          
          logger.info('Biodiversity potential analysis completed successfully:', result.id);
          resolve(result);
        } catch (parseError) {
          logger.error('Error parsing biodiversity potential analysis results:', parseError);
          reject(new Error(`Failed to parse biodiversity potential analysis results: ${parseError.message}`));
        }
      });
    });
  } catch (error) {
    logger.error('Biodiversity potential analysis error:', error);
    throw error;
  }
} 