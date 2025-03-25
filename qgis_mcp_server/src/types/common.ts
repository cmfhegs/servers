/**
 * Common type definitions for the QGIS MCP server
 */

// Base response structure for all QGIS operations
export interface OperationResponse {
  success: boolean;
  data?: any;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
}

// Base path structure for file outputs
export interface OutputPaths {
  [key: string]: string | undefined;
}

// Generic statistics object for operation results
export interface Statistics {
  [key: string]: number | string | object | undefined;
}

// Standard metadata for operation results
export interface OperationMetadata {
  operation: string;
  execution_time: string;
  timestamp: string;
  parameters?: {
    [key: string]: any;
  };
}

// Coordinates for points of interest
export interface Coordinates {
  x: number;
  y: number;
  z?: number;
}

// Named point of interest with coordinates and attributes
export interface PointOfInterest extends Coordinates {
  type: string;
  name?: string;
  description?: string;
  attributes?: {
    [key: string]: any;
  };
}

// Area classification with statistics
export interface AreaClassification {
  class: string;
  area_sqm: number;
  area_percent: number;
  [key: string]: any;
}

// File format options for outputs
export enum OutputFormat {
  GEOTIFF = 'geotiff',
  GEOPACKAGE = 'gpkg',
  SHAPEFILE = 'shp',
  GeoJSON = 'geojson',
  PNG = 'png',
  CSV = 'csv',
  JSON = 'json'
}

// Slope units for terrain analysis
export enum SlopeUnits {
  DEGREES = 'degrees',
  PERCENT = 'percent'
}

// Flow routing algorithms
export enum FlowRoutingAlgorithm {
  D8 = 'd8',
  D_INFINITY = 'd-infinity',
  MFD = 'mfd'
}

// BMP types for suitability analysis
export enum BMPType {
  BIORETENTION = 'bioretention',
  PERMEABLE_PAVEMENT = 'permeable_pavement',
  DETENTION = 'detention',
  BIOSWALE = 'bioswale',
  RAINWATER_HARVESTING = 'rainwater_harvesting',
  GREEN_ROOF = 'green_roof'
}

// Connection types for green infrastructure networks
export enum ConnectionType {
  SURFACE = 'surface',
  SUBSURFACE = 'subsurface',
  VISUAL = 'visual',
  ECOLOGICAL = 'ecological'
}

// Suitability levels for site analysis
export enum SuitabilityLevel {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  UNSUITABLE = 'unsuitable'
}

// Rainfall distribution types
export enum RainfallDistribution {
  SCS_TYPE_I = 'SCS Type I',
  SCS_TYPE_IA = 'SCS Type IA',
  SCS_TYPE_II = 'SCS Type II',
  SCS_TYPE_III = 'SCS Type III',
  NRCS_MSE3 = 'NRCS MSE3',
  NRCS_MSE4 = 'NRCS MSE4'
}

// Base interface for QGIS process execution
export interface QGISProcessOptions {
  processName: string;
  parameters: { [key: string]: any };
  context?: { [key: string]: any };
  feedback?: boolean;
  timeout?: number;
}

// QGIS layer types
export enum QGISLayerType {
  RASTER = 'raster',
  VECTOR = 'vector',
  MESH = 'mesh'
}

// Interface for QGIS layer information
export interface QGISLayerInfo {
  name: string;
  type: QGISLayerType;
  path: string;
  crs?: string;
  featureCount?: number;
  geometryType?: string;
  fields?: string[];
}
