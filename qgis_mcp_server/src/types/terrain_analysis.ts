/**
 * Type definitions for terrain analysis operations
 */

import {
  OutputFormat,
  SlopeUnits,
  OperationResponse,
  AreaClassification,
  OutputPaths,
  Statistics
} from './common.js';

// Slope Analysis Parameters
export interface SlopeAnalysisParams {
  dem_path: string;                       // Path to DEM file
  output_path: string;                    // Path to save output
  output_format?: OutputFormat;           // Format for output files
  slope_units?: SlopeUnits;               // Units for slope measurement
  class_ranges?: number[];                // Slope classification breakpoints
  class_labels?: string[];                // Labels for slope classes
  stormwater_suitability?: boolean;       // Include stormwater suitability analysis
  z_factor?: number;                      // Z factor for vertical exaggeration
  create_visualization?: boolean;         // Create visualization output
  visualization_style?: 'singleband' | 'pseudocolor' | 'classified';  // Visualization style
}

// Slope Classification Result
export interface SlopeClassification extends AreaClassification {
  suitability?: string;                   // Stormwater suitability rating
}

// Stormwater Suitability by BMP Type
export interface StormwaterSuitability {
  bioretention: string;
  permeable_pavement: string;
  detention: string;
  bioswale?: string;
  rainwater_harvesting?: string;
  green_roof?: string;
}

// Slope Analysis Paths Output
export interface SlopeAnalysisPaths extends OutputPaths {
  output_raster: string;                  // Path to output raster
  visualization?: string;                 // Path to visualization
  classified_slope?: string;              // Path to classified slope
  suitability_map?: string;               // Path to suitability map
}

// Slope Analysis Statistics
export interface SlopeAnalysisStats extends Statistics {
  min_slope: number;                      // Minimum slope value
  max_slope: number;                      // Maximum slope value
  mean_slope: number;                     // Mean slope value
  median_slope: number;                   // Median slope value
  std_dev?: number;                       // Standard deviation
}

// Slope Analysis Result Data
export interface SlopeAnalysisData {
  operation: string;                      // Operation name
  paths: SlopeAnalysisPaths;              // Output file paths
  statistics: SlopeAnalysisStats;         // Statistical summary
  classification: SlopeClassification[];  // Slope classification results
  stormwater_suitability?: StormwaterSuitability; // Stormwater BMP suitability
  execution_time: string;                 // Execution time
}

// Slope Analysis Response
export interface SlopeAnalysisResponse extends OperationResponse {
  data?: SlopeAnalysisData;
}

// Flow Path Analysis Parameters
export interface FlowPathAnalysisParams {
  dem_path: string;                       // Path to DEM file
  output_path: string;                    // Path to save output
  algorithm?: 'd8' | 'd-infinity' | 'mfd';// Flow routing algorithm
  accumulation_threshold?: number;        // Minimum accumulation to define stream
  snap_points_path?: string;              // Points for flow path origins/destinations
  culvert_points_path?: string;           // Points representing culverts
  barriers_path?: string;                 // Line features representing barriers
  create_visualization?: boolean;         // Create visualization output
  fill_sinks?: boolean;                   // Fill sinks in DEM before processing
}

// Critical Point in Flow Analysis
export interface CriticalPoint {
  type: 'concentration' | 'diversion' | 'inlet' | 'outlet' | 'culvert';
  x: number;
  y: number;
  accumulation: number;
  attributes?: {
    [key: string]: any;
  };
}

// Suggested BMP Location
export interface SuggestedBMPLocation {
  type: string;                           // Type of BMP
  x: number;                              // X coordinate
  y: number;                              // Y coordinate
  drainage_area_sqm: number;              // Drainage area
  attributes?: {
    [key: string]: any;
  };
}

// Flow Path Analysis Paths Output
export interface FlowPathAnalysisPaths extends OutputPaths {
  flow_accumulation: string;              // Path to flow accumulation raster
  flow_direction: string;                 // Path to flow direction raster
  stream_network?: string;                // Path to stream network vector
  visualization?: string;                 // Path to visualization
}

// Flow Path Analysis Statistics
export interface FlowPathAnalysisStats extends Statistics {
  total_flow_paths: number;               // Total number of flow paths
  main_flow_path_length_m: number;        // Length of main flow path
  max_accumulation_value: number;         // Maximum flow accumulation value
}

// Stormwater Implications from Flow Analysis
export interface StormwaterImplications {
  critical_points: CriticalPoint[];       // Critical points in flow network
  suggested_bmp_locations?: SuggestedBMPLocation[]; // Suggested BMP locations
}

// Flow Path Analysis Result Data
export interface FlowPathAnalysisData {
  operation: string;                      // Operation name
  paths: FlowPathAnalysisPaths;           // Output file paths
  statistics: FlowPathAnalysisStats;      // Statistical summary
  stormwater_implications?: StormwaterImplications; // Stormwater implications
  execution_time: string;                 // Execution time
}

// Flow Path Analysis Response
export interface FlowPathAnalysisResponse extends OperationResponse {
  data?: FlowPathAnalysisData;
}
