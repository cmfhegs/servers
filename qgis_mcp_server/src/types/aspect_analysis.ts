/**
 * Type definitions for Aspect Analysis
 */

// Aspect Analysis Parameters
export interface AspectAnalysisParameters {
  dem_path: string;
  output_path: string;
  categories?: number;
  output_format?: 'geotiff' | 'png' | 'tif';
  include_flat?: boolean;
  category_labels?: string[];
}

// Aspect classification
export interface AspectClass {
  name: string;
  range: [number, number];
  color: string;
}

// Aspect analysis statistics
export interface AspectStatistics {
  predominant_direction: string;
  direction_counts: Record<string, number>;
  total_pixels: number;
  average_aspect?: number;
  aspect_distribution?: Record<string, number>;
}

// Aspect analysis result
export interface AspectAnalysisResult {
  id: string;
  timestamp: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  aspect_raster_path: string;
  visualization_path: string;
  aspect_classes: AspectClass[];
  statistics: AspectStatistics;
  metadata: {
    operation_time: string;
    operation_type: string;
    input_dem: string;
    output_files: string[];
    parameters: {
      categories: number;
      output_format: string;
      include_flat: boolean;
    };
  };
} 