/**
 * Type definitions for terrain analysis operations
 */

/**
 * Parameters for slope analysis operation
 */
export interface SlopeAnalysisParams {
  /** Path to the DEM file */
  dem_path: string;
  
  /** Path to save the output slope raster */
  output_path: string;
  
  /** Format for the output */
  output_format?: 'geotiff' | 'gpkg' | 'png';
  
  /** Units for slope measurement */
  slope_units?: 'degrees' | 'percent';
  
  /** Slope classification breakpoints */
  class_ranges?: number[];
  
  /** Labels for slope classes */
  class_labels?: string[];
  
  /** Include stormwater management suitability analysis */
  stormwater_suitability?: boolean;
}

/**
 * Parameters for flow path analysis operation 
 */
export interface FlowPathAnalysisParams {
  /** Path to the DEM file */
  dem_path: string;
  
  /** Path to save the output flow paths */
  output_path: string;
  
  /** Flow routing algorithm */
  algorithm?: 'd8' | 'd-infinity' | 'mfd';
  
  /** Minimum flow accumulation value to define a stream */
  accumulation_threshold?: number;
  
  /** Path to point features to use as flow path origins/destinations */
  snap_points_path?: string;
  
  /** Fill sinks in the DEM before processing */
  fill_sinks?: boolean;
}

/**
 * Slope classification result
 */
export interface SlopeClassification {
  /** Class label */
  class: string;
  
  /** Area in square meters */
  area_sqm: number;
  
  /** Area percentage */
  area_percent: number;
  
  /** Suitability rating for stormwater management */
  suitability: string;
}

/**
 * Statistics for slope analysis
 */
export interface SlopeStatistics {
  /** Minimum slope value */
  min_slope: number;
  
  /** Maximum slope value */
  max_slope: number;
  
  /** Mean slope value */
  mean_slope: number;
  
  /** Median slope value */
  median_slope: number;
  
  /** Standard deviation of slope values */
  std_dev: number;
}

/**
 * Stormwater management suitability results
 */
export interface StormwaterSuitability {
  /** Suitability for bioretention facilities */
  bioretention: string;
  
  /** Suitability for permeable pavement */
  permeable_pavement: string;
  
  /** Suitability for detention facilities */
  detention: string;
  
  /** Suitability for bioswale facilities */
  bioswale: string;
}

/**
 * Result paths for slope analysis
 */
export interface SlopeAnalysisPaths {
  /** Path to the output slope raster */
  output_raster: string;
  
  /** Path to the visualization image */
  visualization: string;
  
  /** Path to the classified slope raster */
  classified_slope?: string;
}

/**
 * Result data for slope analysis
 */
export interface SlopeAnalysisData {
  /** Operation identifier */
  operation: string;
  
  /** Output file paths */
  paths: SlopeAnalysisPaths;
  
  /** Slope statistics */
  statistics: SlopeStatistics;
  
  /** Slope classification results */
  classification: SlopeClassification[];
  
  /** Stormwater suitability results */
  stormwater_suitability?: StormwaterSuitability;
  
  /** Execution time */
  execution_time: string;
}
