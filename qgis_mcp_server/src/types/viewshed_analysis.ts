/**
 * Type definitions for Viewshed Analysis
 */

// Observer point for viewshed analysis
export interface ObserverPoint {
  x: number;
  y: number;
  height?: number;
  id?: string;
}

// Viewshed Analysis Parameters
export interface ViewshedAnalysisParameters {
  dem_path: string;
  output_path: string;
  observer_points: ObserverPoint[];
  observer_height?: number;
  radius?: number;
  output_format?: 'geotiff' | 'png' | 'tif';
}

// Viewshed analysis statistics
export interface ViewshedStatistics {
  visibleAreaKm2: number;
  percentageVisible: number;
  maxDistance: number;
  totalArea?: number;
  minElevation?: number;
  maxElevation?: number;
  averageVisibleDistance?: number;
}

// Viewshed analysis result
export interface ViewshedAnalysisResult {
  id: string;
  timestamp: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  viewshed_raster_path: string;
  visualization_path: string;
  geojson_path?: string;
  visible_areas?: any; // GeoJSON
  non_visible_areas?: any; // GeoJSON
  observer_points: ObserverPoint[];
  statistics: ViewshedStatistics;
  metadata: {
    operation_time: string;
    operation_type: string;
    input_dem: string;
    output_files: string[];
    parameters: {
      observer_points: ObserverPoint[];
      observer_height: number;
      radius: number;
      output_format: string;
    };
  };
} 