/**
 * Sensor Data Manager Service
 * 
 * This service manages sensor data collection, aggregation, and integration with McHarg layers.
 * It supports the sensor types specified in the requirements and implements the time-scale 
 * based aggregation system with daily time scale as the highest priority.
 */

import { SensorDataLayer } from '../models/mcHargLayers.js';

// Sensor metadata definition
export interface SensorMetadata {
  id: string;
  type: string; // temperature, humidity, soil_moisture, etc.
  location: {
    x: number;
    y: number;
    z: number;
    accuracy: number;
  };
  installationDate: string;
  manufacturer?: string;
  model?: string;
  calibrationInfo?: any;
  measurementUnits: string;
  samplingRate?: number; // In seconds
  dataFormat?: string;
}

// Individual sensor reading
export interface SensorReading {
  sensorId: string;
  timestamp: string;
  value: number | object | string;
  quality?: number; // 0-1 indicator of data quality
  metadata?: any;
}

// Aggregated sensor data
export interface SensorDataAggregate {
  sensorId: string;
  period: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'seasonal' | 'annual';
  startTime: string;
  endTime: string;
  statistics: {
    min: number;
    max: number;
    mean: number;
    median: number;
    stdDev: number;
    count: number;
    [key: string]: any; // Additional statistics
  };
  trends?: {
    slope?: number;
    intercept?: number;
    r2?: number;
    significanceLevel?: number;
  };
  anomalies?: {
    count: number;
    details: Array<{
      timestamp: string;
      value: number;
      zScore: number;
    }>;
  };
}

export class SensorDataManager {
  private sensorRegistry: Map<string, SensorMetadata>;
  private readings: Map<string, SensorReading[]>; // In-memory storage for demo
  private aggregates: Map<string, SensorDataAggregate[]>;
  
  constructor() {
    this.sensorRegistry = new Map();
    this.readings = new Map();
    this.aggregates = new Map();
    
    // In a real implementation, this would connect to a database
    console.log('SensorDataManager initialized');
  }
  
  /**
   * Register a new sensor in the system
   */
  registerSensor(metadata: SensorMetadata): string {
    // Validate sensor data
    this.validateSensorMetadata(metadata);
    
    // Add sensor to registry
    this.sensorRegistry.set(metadata.id, metadata);
    this.readings.set(metadata.id, []);
    
    console.log(`Sensor registered: ${metadata.id} (${metadata.type})`);
    return metadata.id;
  }
  
  /**
   * Get a registered sensor by ID
   */
  getSensor(sensorId: string): SensorMetadata | undefined {
    return this.sensorRegistry.get(sensorId);
  }
  
  /**
   * Get all registered sensors
   */
  getAllSensors(): SensorMetadata[] {
    return Array.from(this.sensorRegistry.values());
  }
  
  /**
   * Get sensors by type
   */
  getSensorsByType(type: string): SensorMetadata[] {
    return Array.from(this.sensorRegistry.values())
      .filter(sensor => sensor.type === type);
  }
  
  /**
   * Get sensors near a location
   */
  getSensorsNear(x: number, y: number, z: number, radius: number): SensorMetadata[] {
    return Array.from(this.sensorRegistry.values())
      .filter(sensor => {
        const distance = Math.sqrt(
          Math.pow(sensor.location.x - x, 2) +
          Math.pow(sensor.location.y - y, 2) +
          Math.pow(sensor.location.z - z, 2)
        );
        return distance <= radius;
      });
  }
  
  /**
   * Ingest sensor data readings
   */
  async ingestData(readings: SensorReading[]): Promise<{
    processedCount: number,
    errors: { reading: SensorReading, error: string }[]
  }> {
    const errors: { reading: SensorReading, error: string }[] = [];
    let processedCount = 0;
    
    for (const reading of readings) {
      try {
        // Check if sensor exists
        if (!this.sensorRegistry.has(reading.sensorId)) {
          errors.push({
            reading,
            error: `Sensor with ID ${reading.sensorId} not found`
          });
          continue;
        }
        
        // Validate reading
        this.validateReading(reading);
        
        // Store reading
        const existingReadings = this.readings.get(reading.sensorId) || [];
        existingReadings.push(reading);
        this.readings.set(reading.sensorId, existingReadings);
        
        processedCount++;
      } catch (error) {
        errors.push({
          reading,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Trigger aggregation if needed
    await this.triggerAggregations();
    
    return { processedCount, errors };
  }
  
  /**
   * Get latest reading for a sensor
   */
  getLatestReading(sensorId: string): SensorReading | undefined {
    const readings = this.readings.get(sensorId);
    if (!readings || readings.length === 0) {
      return undefined;
    }
    
    // Sort by timestamp descending and return the first one
    return [...readings].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];
  }
  
  /**
   * Get readings for a sensor in a time range
   */
  getReadings(
    sensorId: string,
    startTime: string,
    endTime: string
  ): SensorReading[] {
    const readings = this.readings.get(sensorId);
    if (!readings) {
      return [];
    }
    
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    
    return readings.filter(reading => {
      const timestamp = new Date(reading.timestamp).getTime();
      return timestamp >= start && timestamp <= end;
    });
  }
  
  /**
   * Get aggregated data for sensors
   */
  getAggregatedData(
    sensorIds: string[],
    period: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'seasonal' | 'annual',
    startTime: string,
    endTime: string
  ): SensorDataAggregate[] {
    const results: SensorDataAggregate[] = [];
    
    for (const sensorId of sensorIds) {
      const aggregates = this.aggregates.get(sensorId) || [];
      
      // Filter by period and time range
      const filteredAggregates = aggregates.filter(agg => {
        if (agg.period !== period) {
          return false;
        }
        
        const aggStart = new Date(agg.startTime).getTime();
        const aggEnd = new Date(agg.endTime).getTime();
        const requestStart = new Date(startTime).getTime();
        const requestEnd = new Date(endTime).getTime();
        
        // Check if there's any overlap in the time ranges
        return aggStart <= requestEnd && aggEnd >= requestStart;
      });
      
      results.push(...filteredAggregates);
    }
    
    return results;
  }
  
  /**
   * Create a time series object for a sensor
   */
  createTimeSeries(
    sensorId: string,
    startTime: string,
    endTime: string,
    resolution: 'hourly' | 'daily' | 'weekly' | 'monthly'
  ): { timestamps: string[], values: number[] } {
    const readings = this.getReadings(sensorId, startTime, endTime);
    
    if (readings.length === 0) {
      return { timestamps: [], values: [] };
    }
    
    // Group readings by the appropriate time bucket
    const buckets = new Map<string, number[]>();
    
    for (const reading of readings) {
      const date = new Date(reading.timestamp);
      let bucketKey: string;
      
      switch (resolution) {
        case 'hourly':
          bucketKey = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}-${date.getHours()}`;
          break;
        case 'daily':
          bucketKey = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
          break;
        case 'weekly':
          // Get the week number
          const onejan = new Date(date.getFullYear(), 0, 1);
          const weekNum = Math.ceil(((date.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
          bucketKey = `${date.getFullYear()}-W${weekNum}`;
          break;
        case 'monthly':
          bucketKey = `${date.getFullYear()}-${date.getMonth()+1}`;
          break;
      }
      
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, []);
      }
      
      // Ensure the value is a number
      const value = typeof reading.value === 'number' 
        ? reading.value 
        : typeof reading.value === 'string'
          ? parseFloat(reading.value)
          : NaN;
      
      if (!isNaN(value)) {
        buckets.get(bucketKey)!.push(value);
      }
    }
    
    // Calculate the average for each bucket
    const timestamps: string[] = [];
    const values: number[] = [];
    
    for (const [bucketKey, bucketValues] of buckets.entries()) {
      timestamps.push(bucketKey);
      values.push(
        bucketValues.reduce((sum, val) => sum + val, 0) / bucketValues.length
      );
    }
    
    // Sort by timestamp
    const sortedIndices = timestamps
      .map((_, i) => i)
      .sort((a, b) => timestamps[a].localeCompare(timestamps[b]));
    
    return {
      timestamps: sortedIndices.map(i => timestamps[i]),
      values: sortedIndices.map(i => values[i])
    };
  }
  
  /**
   * Get sensor data for a McHarg layer
   */
  async getSensorDataForLayer(
    layerType: string,
    layerName: string,
    sensors: SensorMetadata[],
    timePoint?: string
  ): Promise<any> {
    // Determine which sensor types are relevant for this layer
    const relevantSensorTypes = this.getRelevantSensorTypesForLayer(layerType, layerName);
    
    // Filter sensors by relevant types
    const filteredSensors = sensors.filter(sensor => 
      relevantSensorTypes.includes(sensor.type)
    );
    
    // Get the most recent data for these sensors if no time point is specified
    if (!timePoint) {
      timePoint = new Date().toISOString();
    }
    
    // Define the time range for sensor data (one day before the specified time point)
    const endTime = new Date(timePoint);
    const startTime = new Date(endTime);
    startTime.setDate(startTime.getDate() - 1);
    
    // Get data for each sensor
    const sensorData: Record<string, any> = {};
    
    for (const sensor of filteredSensors) {
      const readings = this.getReadings(
        sensor.id,
        startTime.toISOString(),
        endTime.toISOString()
      );
      
      if (readings.length > 0) {
        // Calculate statistics
        const values = readings
          .map(r => typeof r.value === 'number' ? r.value : 
               typeof r.value === 'string' ? parseFloat(r.value) : NaN)
          .filter(v => !isNaN(v));
        
        if (values.length > 0) {
          sensorData[sensor.id] = {
            sensorType: sensor.type,
            location: sensor.location,
            units: sensor.measurementUnits,
            statistics: this.calculateStatistics(values),
            timeRange: {
              start: startTime.toISOString(),
              end: endTime.toISOString()
            }
          };
        }
      }
    }
    
    return {
      layerType,
      layerName,
      timePoint,
      sensorData
    };
  }
  
  /**
   * Create a McHarg layer enhanced with sensor data
   */
  async createSensorEnhancedLayer(
    layerType: string,
    layerName: string,
    baseLayerData: any,
    sensorTimePoint?: string
  ): Promise<any> {
    // Get sensors that are relevant for this layer
    const relevantSensorTypes = this.getRelevantSensorTypesForLayer(layerType, layerName);
    const sensors = Array.from(this.sensorRegistry.values())
      .filter(sensor => relevantSensorTypes.includes(sensor.type));
    
    // Get sensor data for the specified time
    const sensorData = await this.getSensorDataForLayer(
      layerType,
      layerName,
      sensors,
      sensorTimePoint
    );
    
    // Enhance the base layer with sensor data
    return {
      ...baseLayerData,
      sensorEnhancement: {
        timePoint: sensorData.timePoint,
        sensorCoverage: sensors.length,
        sensorData: sensorData.sensorData
      }
    };
  }
  
  // Private helper methods
  
  /**
   * Validate sensor metadata
   */
  private validateSensorMetadata(metadata: SensorMetadata): void {
    if (!metadata.id) {
      throw new Error('Sensor ID is required');
    }
    
    if (!metadata.type) {
      throw new Error('Sensor type is required');
    }
    
    if (!metadata.location) {
      throw new Error('Sensor location is required');
    }
    
    if (!metadata.measurementUnits) {
      throw new Error('Measurement units are required');
    }
    
    // Check if sensor with this ID already exists
    if (this.sensorRegistry.has(metadata.id)) {
      throw new Error(`Sensor with ID ${metadata.id} already exists`);
    }
    
    // Check if sensor type is supported
    const supportedTypes = [
      'temperature', 'humidity', 'soil_moisture', 'light',
      'water_level', 'air_quality', 'wind', 'precipitation',
      'sound', 'motion'
    ];
    
    if (!supportedTypes.includes(metadata.type)) {
      throw new Error(`Unsupported sensor type: ${metadata.type}`);
    }
  }
  
  /**
   * Validate sensor reading
   */
  private validateReading(reading: SensorReading): void {
    if (!reading.sensorId) {
      throw new Error('Sensor ID is required');
    }
    
    if (!reading.timestamp) {
      throw new Error('Timestamp is required');
    }
    
    if (reading.value === undefined || reading.value === null) {
      throw new Error('Value is required');
    }
    
    // Validate timestamp format
    if (isNaN(Date.parse(reading.timestamp))) {
      throw new Error('Invalid timestamp format');
    }
  }
  
  /**
   * Trigger data aggregations based on configured schedules
   */
  private async triggerAggregations(): Promise<void> {
    // In a real implementation, this would check if it's time to run aggregations
    // For now, we'll just run daily aggregation on every data ingestion
    await this.aggregateDaily();
    
    // Other aggregations would be scheduled less frequently
    // For example:
    // - Hourly: Run every hour
    // - Daily: Run once per day (e.g., at midnight)
    // - Weekly: Run once per week
    // - Monthly: Run once per month
    // - Seasonal: Run once per season
    // - Annual: Run once per year
  }
  
  /**
   * Aggregate data for daily time scale
   */
  private async aggregateDaily(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // For each sensor, calculate daily aggregates
    for (const [sensorId, metadata] of this.sensorRegistry.entries()) {
      try {
        const readings = this.getReadings(
          sensorId,
          today.toISOString(),
          tomorrow.toISOString()
        );
        
        if (readings.length === 0) {
          continue;
        }
        
        // Extract numerical values
        const values = readings
          .map(r => typeof r.value === 'number' ? r.value : 
               typeof r.value === 'string' ? parseFloat(r.value) : NaN)
          .filter(v => !isNaN(v));
        
        if (values.length === 0) {
          continue;
        }
        
        // Calculate statistics
        const stats = this.calculateStatistics(values);
        
        // Create aggregate object
        const aggregate: SensorDataAggregate = {
          sensorId,
          period: 'daily',
          startTime: today.toISOString(),
          endTime: tomorrow.toISOString(),
          statistics: {
            min: stats.min,
            max: stats.max,
            mean: stats.mean,
            median: stats.median,
            stdDev: stats.stdDev,
            count: values.length
          }
        };
        
        // Add sensor-type specific statistics
        this.addSensorTypeSpecificStats(aggregate, metadata.type, values);
        
        // Store the aggregate
        const existingAggregates = this.aggregates.get(sensorId) || [];
        existingAggregates.push(aggregate);
        this.aggregates.set(sensorId, existingAggregates);
        
        console.log(`Generated daily aggregate for sensor ${sensorId}`);
      } catch (error) {
        console.error(`Error aggregating data for sensor ${sensorId}:`, error);
      }
    }
  }
  
  /**
   * Calculate basic statistics for a set of values
   */
  private calculateStatistics(values: number[]): {
    min: number;
    max: number;
    mean: number;
    median: number;
    stdDev: number;
  } {
    if (values.length === 0) {
      throw new Error('Cannot calculate statistics for empty dataset');
    }
    
    // Sort values for percentile calculations
    const sortedValues = [...values].sort((a, b) => a - b);
    
    // Calculate mean
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    // Calculate median
    let median: number;
    const mid = Math.floor(sortedValues.length / 2);
    if (sortedValues.length % 2 === 0) {
      median = (sortedValues[mid - 1] + sortedValues[mid]) / 2;
    } else {
      median = sortedValues[mid];
    }
    
    // Calculate standard deviation
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      min: sortedValues[0],
      max: sortedValues[sortedValues.length - 1],
      mean,
      median,
      stdDev
    };
  }
  
  /**
   * Add sensor type specific statistics to an aggregate
   */
  private addSensorTypeSpecificStats(
    aggregate: SensorDataAggregate,
    sensorType: string,
    values: number[]
  ): void {
    switch (sensorType) {
      case 'temperature':
        // Add degree days, extremes, etc.
        aggregate.statistics.freezingHours = values.filter(v => v <= 0).length;
        aggregate.statistics.heatingDegreeDays = values
          .filter(v => v < 18) // Assuming 18°C as base temperature
          .reduce((sum, v) => sum + (18 - v), 0) / 24; // Convert to degree-days
        break;
        
      case 'precipitation':
        // Add total precipitation, max intensity, etc.
        aggregate.statistics.totalPrecipitation = values.reduce((sum, v) => sum + v, 0);
        aggregate.statistics.precipitationHours = values.filter(v => v > 0).length;
        aggregate.statistics.maxIntensity = Math.max(...values);
        break;
        
      case 'soil_moisture':
        // Add time below field capacity, etc.
        const fieldCapacity = 30; // Example threshold, would be sensor-specific
        aggregate.statistics.hoursBelowFieldCapacity = values.filter(v => v < fieldCapacity).length;
        aggregate.statistics.meanSaturationPercentage = aggregate.statistics.mean / 100;
        break;
        
      // Add more sensor types as needed
    }
  }
  
  /**
   * Get relevant sensor types for a McHarg layer
   */
  private getRelevantSensorTypesForLayer(
    layerType: string,
    layerName: string
  ): string[] {
    // Define which sensor types are relevant for each layer
    const layerSensorMap: Record<string, string[]> = {
      'physical.physiography': [],
      'physical.hydrology': ['water_level', 'precipitation'],
      'physical.soils': ['soil_moisture'],
      'physical.climate': ['temperature', 'humidity', 'wind', 'precipitation'],
      'biological.vegetation': ['soil_moisture', 'light', 'temperature'],
      'biological.wildlife': ['motion', 'sound']
    };
    
    const key = `${layerType}.${layerName}`;
    return layerSensorMap[key] || [];
  }
}
