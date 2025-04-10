/**
 * Type definitions for Watershed Analysis
 */

// Pour point for watershed analysis
export interface PourPoint {
  x: number;
  y: number;
  id?: string;
}

// Watershed Analysis Parameters
export interface WatershedAnalysisParameters {
  dem_path: string;
  output_path: string;
  pour_points: PourPoint[] | [number, number][];
  snap_distance?: number;
  min_basin_size?: number;
  output_format?: 'geotiff' | 'png' | 'tif';
}

// Individual watershed data
export interface Watershed {
  id: string;
  area_km2: number;
  pour_point: [number, number];
  highest_elevation: number;
  lowest_elevation: number;
  stream_length_km?: number;
}

// Watershed analysis statistics
export interface WatershedStatistics {
  watershed_count: number;
  total_area_km2: number;
  average_area_km2: number;
  min_area_km2: number;
  max_area_km2: number;
  watershed_sizes?: Record<string, number>;
  total_stream_length_km?: number;
  drainage_density?: number;
}

// Watershed analysis result
export interface WatershedAnalysisResult {
  id: string;
  timestamp: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  watershed_raster_path: string;
  visualization_path: string;
  geojson_path?: string;
  stream_network_path?: string;
  watersheds: Watershed[];
  statistics: WatershedStatistics;
  metadata: {
    operation_time: string;
    operation_type: string;
    input_dem: string;
    output_files: string[];
    parameters: {
      pour_points: Array<[number, number]>;
      snap_distance: number;
      min_basin_size: number;
      output_format: string;
    };
  };
} 