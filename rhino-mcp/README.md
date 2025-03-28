# Rhino.compute MCP Server with Land Kit Pro Integration

This Model Context Protocol (MCP) server interfaces with Rhino.compute and Land Kit Pro to provide advanced terrain analysis capabilities. It implements Ian McHarg's layer-based site analysis methodology, includes sensor data integration, and supports comprehensive landscape architectural analysis for planning and design.

## Features

- **McHarg Layer Analysis**: Implementation of McHarg's layer-based site analysis methodology
- **Priority Layers**: Includes physiography (terrain), hydrology, soils, vegetation, wildlife habitat, and climate
- **Sensor Integration**: Support for environmental sensors with time-based aggregation
- **Suitability Analysis**: Multi-criteria weighted overlay analysis for site suitability
- **Land Kit Pro Integration**: Professional landscape architecture toolkit for Rhino

## Prerequisites

- Node.js (v18 or higher)
- Rhino.compute instance (local or remote)
- Access to environmental data sources (DEM, soils, etc.)
- Land Kit Pro license and API access

## Installation

1. Clone this repository
2. Install dependencies:

```bash
cd servers/rhino-mcp
npm install
```

3. Build the TypeScript files:

```bash
npm run build
```

## Configuration

Create a `.env` file in the root directory with the following variables:

```
# Rhino.compute Configuration
RHINO_COMPUTE_URL=http://your-rhino-compute-server:8081/

# Land Kit Pro Configuration
LAND_KIT_API_URL=http://your-land-kit-pro-server:9000/
LAND_KIT_API_KEY=your-land-kit-pro-api-key
```

## Usage

### Starting the Server

```bash
npm start
```

### Available Tools

The MCP server provides the following tools:

#### McHarg Layer Analysis Tools

- `mcHarg_terrain_analysis`: Analyze terrain characteristics (slope, aspect, curvature, landform classification)
- `mcHarg_hydrology_analysis`: Analyze hydrological characteristics (watersheds, flow patterns, etc.)
- `mcHarg_soils_analysis`: Analyze soil characteristics and suitability
- `mcHarg_suitability_analysis`: Perform multi-criteria suitability analysis

#### Sensor Integration Tools

- `register_sensor`: Register a new environmental sensor
- `ingest_sensor_data`: Ingest data readings from registered sensors

#### Land Kit Pro Tools

- `landkit_generate_contours`: Generate contours from a digital elevation model
- `landkit_create_profiles`: Create terrain profiles along specified lines
- `landkit_calculate_cut_fill`: Calculate cut and fill volumes between surfaces
- `landkit_analyze_watersheds`: Analyze watersheds from pour points
- `landkit_generate_flow_paths`: Generate water flow paths from start points
- `landkit_analyze_viewshed`: Perform viewshed analysis from viewer points
- `landkit_analyze_solar`: Perform solar radiation analysis
- `landkit_apply_vegetation`: Apply vegetation to a site

### Example Tool Invocation

Using the MCP client SDK:

```typescript
// McHarg analysis
const mcHargResult = await mcpClient.callTool('mcHarg_terrain_analysis', {
  dem: {
    url: 'https://example.com/path/to/dem.tif',
    format: 'GeoTIFF'
  },
  analysis_types: ['slope', 'aspect'],
  parameters: {
    resolution: '10m'
  }
});

// Land Kit Pro integration
const landKitResult = await mcpClient.callTool('landkit_generate_contours', {
  dem_path: '/path/to/dem.tif',
  interval: 1.0,
  smoothing: 0.5,
  parameters: {
    clipBoundary: '/path/to/boundary.json'
  }
});
```

## Sensor Data Integration

The system supports the following sensor types:

- Temperature
- Humidity
- Soil moisture
- Light
- Water level
- Air quality
- Wind
- Precipitation
- Sound
- Motion

Data aggregation is performed at multiple time scales:

1. **Daily** (highest priority): Core operational assessment
2. **Hourly**: Detailed system behavior
3. **Seasonal**: Ecological and performance assessment
4. **Annual**: Long-term performance tracking

## Integration with External Services

### Rhino.compute Integration

This MCP server communicates with a Rhino.compute instance to perform the actual analysis. In the initial implementation, responses are mocked, but in a production environment, the server would call Rhino.compute endpoints for:

1. Terrain analysis
2. Hydrology modeling
3. Soil suitability analysis
4. Other spatial operations

### Land Kit Pro Integration

The server also integrates with Land Kit Pro, a professional landscape architecture toolkit for Rhino. This integration enables:

1. Advanced contour generation
2. Terrain profiling
3. Cut and fill calculations
4. Watershed delineation
5. Flow path generation
6. Viewshed analysis
7. Solar radiation analysis
8. Vegetation application

## Development

### Project Structure

- `src/index.ts`: Main entry point and server setup
- `src/models/`: Data models for McHarg layers and analysis results
- `src/services/`: Service implementations for analysis and data management
- `src/tools/`: MCP tool implementations
- `src/utils/`: Utility functions

### Adding New Tools

To add a new tool:

1. Define appropriate models in `src/models/`
2. Implement the service functionality in `src/services/`
3. Create the tool implementation in `src/tools/`
4. Register the tool in `mcHargTools.ts`

## License

MIT
