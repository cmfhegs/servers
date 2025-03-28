/**
 * McHarg Layer Models
 * 
 * This file defines the data models for Ian McHarg's layer-based site analysis methodology.
 * The models are organized according to the Primary > Secondary > Tertiary hierarchy.
 */

// Base interface for all McHarg layers
export interface McHargLayer {
  id: string;
  name: string;
  description?: string;
  metadata: {
    layerType: 'primary' | 'secondary' | 'tertiary';
    layerCategory: 'physical' | 'biological' | 'social';
    source?: string;
    dateCreated: string;
    dateModified: string;
    creator?: string;
    attributions?: string[];
  };
  data: any; // Type depends on specific layer implementation
  visualization?: {
    colorScheme?: string;
    minValue?: number;
    maxValue?: number;
    classes?: number;
    symbolization?: string;
  };
}

// Physical Layers - Primary category
export interface PhysiographyLayer extends McHargLayer {
  metadata: {
    layerType: 'primary' | 'secondary' | 'tertiary';
    layerCategory: 'physical';
    source?: string;
    dateCreated: string;
    dateModified: string;
    creator?: string;
    attributions?: string[];
    dataResolution?: string; // e.g., "10m"
    verticalDatum?: string; // e.g., "NAVD88"
    horizontalDatum?: string; // e.g., "WGS84"
  };
  data: {
    dem?: {
      url: string;
      format: string; // e.g., "GeoTIFF", "ESRI ASCII"
      noDataValue?: number;
    };
    derivedProducts?: {
      slope?: string;
      aspect?: string;
      curvature?: string;
      landforms?: string;
    };
    statistics?: {
      minElevation: number;
      maxElevation: number;
      meanElevation: number;
      medianElevation: number;
      standardDeviation: number;
    };
  };
}

export interface HydrologyLayer extends McHargLayer {
  metadata: {
    layerType: 'primary' | 'secondary' | 'tertiary';
    layerCategory: 'physical';
    source?: string;
    dateCreated: string;
    dateModified: string;
    creator?: string;
    attributions?: string[];
    dataResolution?: string;
    dataAccuracy?: string;
    seasonality?: string; // e.g., "wet season", "annual average"
  };
  data: {
    waterBodies?: {
      url: string;
      format: string;
      features: {
        type: string; // e.g., "lake", "river", "stream", "wetland"
        name?: string;
        permanence: string; // e.g., "perennial", "intermittent", "ephemeral"
        area?: number;
        length?: number;
      }[];
    };
    watersheds?: {
      url: string;
      format: string;
      features: {
        name: string;
        area: number;
        orderNumber?: number; // Strahler order
      }[];
    };
    flowDirection?: {
      url: string;
      format: string;
    };
    flowAccumulation?: {
      url: string;
      format: string;
    };
    floodZones?: {
      url: string;
      format: string;
      features: {
        returnPeriod: string; // e.g., "100-year", "500-year"
        area: number;
      }[];
    };
  };
}

export interface SoilsLayer extends McHargLayer {
  metadata: {
    layerType: 'primary' | 'secondary' | 'tertiary';
    layerCategory: 'physical';
    source?: string;
    dateCreated: string;
    dateModified: string;
    creator?: string;
    attributions?: string[];
    surveyDate?: string;
    soilClassificationSystem?: string; // e.g., "USDA", "FAO"
  };
  data: {
    soilTypes: {
      url: string;
      format: string;
      features: {
        soilCode: string;
        soilName: string;
        texture: string;
        drainageClass: string; // e.g., "well drained", "poorly drained"
        hydricSoil: boolean;
        erodibility?: number; // K factor
        organicMatter?: number; // percentage
        pH?: number;
        permeability?: number;
        deptToWaterTable?: number; // in cm
        deptToBedrock?: number; // in cm
        slopeRange?: string; // e.g., "0-3%"
        landCapabilityClass?: string; // e.g., "I", "II", "III"
        area: number;
      }[];
    };
    soilErosion?: {
      url: string;
      format: string;
    };
    soilCompaction?: {
      url: string;
      format: string;
    };
  };
}

// Biological Layers
export interface VegetationLayer extends McHargLayer {
  metadata: {
    layerType: 'primary' | 'secondary' | 'tertiary';
    layerCategory: 'biological';
    source?: string;
    dateCreated: string;
    dateModified: string;
    creator?: string;
    attributions?: string[];
    surveyDate?: string;
    classificationSystem?: string; // e.g., "NLCD", "Custom"
  };
  data: {
    vegetationCover: {
      url: string;
      format: string;
      features: {
        coverType: string; // e.g., "forest", "grassland", "shrubland"
        dominantSpecies?: string[];
        canopyCover?: number; // percentage
        height?: number; // average height in meters
        age?: number; // average age in years
        condition?: string; // e.g., "excellent", "good", "fair", "poor"
        nativeStatus?: string; // e.g., "native", "non-native", "invasive"
        area: number;
      }[];
    };
    significantSpecies?: {
      url: string;
      format: string;
      features: {
        scientificName: string;
        commonName?: string;
        conservationStatus?: string; // e.g., "endangered", "threatened"
        location: string; // GeoJSON or similar
      }[];
    };
    habitatValue?: {
      url: string;
      format: string;
    };
    ndvi?: {
      url: string;
      format: string;
      date: string;
    };
  };
}

export interface WildlifeHabitatLayer extends McHargLayer {
  metadata: {
    layerType: 'primary' | 'secondary' | 'tertiary';
    layerCategory: 'biological';
    source?: string;
    dateCreated: string;
    dateModified: string;
    creator?: string;
    attributions?: string[];
    surveyDate?: string;
  };
  data: {
    habitatTypes: {
      url: string;
      format: string;
      features: {
        habitatType: string;
        habitatQuality: string; // e.g., "high", "medium", "low"
        keySpecies: string[];
        connectivityValue?: number; // 0-100
        area: number;
      }[];
    };
    wildlifeObservations?: {
      url: string;
      format: string;
      features: {
        species: string;
        observationDate: string;
        count?: number;
        behavior?: string;
        location: string; // GeoJSON or similar
      }[];
    };
    corridors?: {
      url: string;
      format: string;
      features: {
        corridorType: string; // e.g., "riparian", "forest"
        width: number;
        length: number;
        quality: string; // e.g., "high", "medium", "low"
      }[];
    };
    habitatFragmentation?: {
      url: string;
      format: string;
      metrics: {
        patchDensity: number;
        edgeDensity: number;
        contagionIndex: number;
        meanPatchSize: number;
      };
    };
  };
}

export interface ClimateLayer extends McHargLayer {
  metadata: {
    layerType: 'primary' | 'secondary' | 'tertiary';
    layerCategory: 'physical';
    source?: string;
    dateCreated: string;
    dateModified: string;
    creator?: string;
    attributions?: string[];
    timeRange?: string; // e.g., "2020-2021", "Summer 2021"
    resolution?: string;
  };
  data: {
    temperature?: {
      url: string;
      format: string;
      statistics: {
        min: number;
        max: number;
        mean: number;
        standardDeviation: number;
      };
      temporalData?: {
        annual?: {
          average: number;
          min: number;
          max: number;
        };
        seasonal?: {
          winter: { average: number; min: number; max: number; };
          spring: { average: number; min: number; max: number; };
          summer: { average: number; min: number; max: number; };
          fall: { average: number; min: number; max: number; };
        };
      };
    };
    precipitation?: {
      url: string;
      format: string;
      statistics: {
        annual: number; // mm/year
        monthly: number[]; // 12 values for each month
        seasonality: number; // index of seasonality
      };
    };
    wind?: {
      url: string;
      format: string;
      prevailingDirection: string; // e.g., "NE", "SW"
      averageSpeed: number; // m/s
      seasonalVariation: boolean;
    };
    solar?: {
      url: string;
      format: string;
      annualInsolation: number; // kWh/m²/year
      seasonalVariation: {
        winter: number;
        spring: number;
        summer: number;
        fall: number;
      };
    };
    microclimate?: {
      url: string;
      format: string;
      zones: {
        zoneType: string; // e.g., "urban heat island", "cool pocket"
        averageTemperatureDifference: number; // °C difference from surroundings
        area: number;
      }[];
    };
  };
}

// Sensor data integration model
export interface SensorDataLayer {
  id: string;
  name: string;
  sensorType: string; // e.g., "temperature", "humidity", "soil_moisture"
  location: {
    x: number;
    y: number;
    z: number;
    accuracy: number;
  };
  timeRange: {
    start: string;
    end: string;
  };
  aggregation: 'hourly' | 'daily' | 'seasonal' | 'annual';
  data: {
    timestamps: string[];
    values: number[];
    statistics: {
      min: number;
      max: number;
      mean: number;
      median: number;
      stdDev: number;
    };
  };
  metadata: {
    units: string;
    manufacturer?: string;
    model?: string;
    installationDate: string;
    calibrationInfo?: any;
    dataQuality?: number; // 0-1 indicator of data quality
  };
}

// Temporal analysis model
export interface TemporalAnalysisResult {
  id: string;
  layerId: string;
  timePoints: string[];
  analysisType: 'change_detection' | 'trend' | 'seasonality' | 'comparison';
  results: {
    changeRate?: number;
    changeDirection?: string; // e.g., "increasing", "decreasing", "stable"
    changeSignificance?: number; // p-value or similar
    seasonalComponent?: number[];
    trendComponent?: number[];
    comparisonResults?: {
      timePoint1: string;
      timePoint2: string;
      difference: number;
      percentChange: number;
    }[];
  };
  visualization?: {
    url?: string;
    type: string; // e.g., "line_chart", "heat_map", "difference_map"
  };
}

// Suitability analysis model
export interface SuitabilityAnalysisResult {
  id: string;
  name: string;
  description?: string;
  analysisDate: string;
  layers: {
    layerId: string;
    layerName: string;
    weight: number;
    criteria: {
      field: string;
      operator: string; // e.g., ">", "<", "=", "between"
      value: any;
      suitabilityScore: number; // 1-5 or similar
    }[];
  }[];
  results: {
    url: string;
    format: string;
    classes: {
      classValue: number;
      className: string; // e.g., "Highly Suitable", "Suitable", "Moderately Suitable"
      area: number;
      percentage: number;
    }[];
    statistics: {
      minValue: number;
      maxValue: number;
      meanValue: number;
      medianValue: number;
    };
  };
}
