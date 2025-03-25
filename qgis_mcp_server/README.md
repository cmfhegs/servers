# QGIS MCP Server

This server exposes QGIS operations through the Model Context Protocol (MCP) for stormwater management applications in the Landscape AI platform.

## Overview

The QGIS MCP Server provides a bridge between the Landscape AI system and QGIS, enabling AI assistants to request and execute specialized GIS operations for stormwater management design and analysis. This implementation focuses on Phase 1 (Proof-of-Concept) to demonstrate the feasibility and potential of the integration.

## Features

### Terrain Analysis Operations

- **Slope Analysis**: Calculate slope values from a DEM and classify them according to stormwater management suitability
- **Flow Path Analysis**: Identify stormwater flow paths across terrain to optimize placement of stormwater infrastructure

### Future Operations (Planned)

- **Watershed Delineation**: Delineate watersheds and subcatchments for stormwater management planning
- **Runoff Volume Calculation**: Calculate stormwater runoff volumes based on land cover, soil type, and rainfall data
- **BMP Suitability Analysis**: Analyze site characteristics to determine suitable locations for different stormwater BMPs
- **Green Infrastructure Network Analysis**: Analyze potential connections between stormwater management features

## Technical Architecture

The server is built using TypeScript and follows a modular architecture:

```
qgis_mcp_server/
  ├── src/
  │   ├── index.ts                 # Main server implementation
  │   ├── operations/              # Operation implementations
  │   │   ├── terrain_analysis.ts  # Terrain analysis operations
  │   │   └── ... (future modules)
  │   └── types/                   # Type definitions
  │       ├── common.ts            # Common type definitions
  │       ├── terrain_analysis.ts  # Terrain analysis types
  │       └── ... (future types)
  ├── build/                       # Compiled JavaScript
  ├── package.json
  └── tsconfig.json
```

## Phase 1 Implementation

The current implementation:

1. Establishes the server structure with TypeScript
2. Creates type definitions for operations and responses
3. Implements mock operations for slope analysis and flow path analysis
4. Includes logging and error handling
5. Provides a foundation for adding real QGIS operations in Phase 2

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- TypeScript 5.x or higher
- (Future) QGIS 3.x with Python support

### Installation

1. Install dependencies:
   ```
   npm install
   ```

2. Build the server:
   ```
   npm run build
   ```

3. Start the server:
   ```
   npm start
   ```

## MCP Integration

The server implements the Model Context Protocol, allowing AI assistants to:

1. Discover available tools through the `ListTools` request
2. Execute operations using the `CallTool` request
3. Receive structured responses with GIS operation results

## Current Limitations

- Phase 1 implementation uses mock operations instead of actual QGIS processing
- Error handling is basic and will be enhanced in future phases
- Only two operations are implemented in this phase

## Next Steps

1. **Environment Setup**: Create containerized QGIS environment for consistent execution
2. **Real QGIS Integration**: Implement actual QGIS processing through PyQGIS scripts
3. **Additional Operations**: Add watershed delineation and runoff volume calculation
4. **Advanced Error Handling**: Enhance error handling and input validation
5. **Testing Framework**: Develop comprehensive testing framework

## Development

### Scripts

- `npm run build`: Build the TypeScript code
- `npm run start`: Start the server
- `npm run dev`: Run in development mode with ts-node
- `npm run test`: Run tests
- `npm run lint`: Run linting

### Adding a New Operation

1. Define the operation types in `src/types/`
2. Implement the operation in `src/operations/`
3. Register the operation in `src/index.ts` under the `setupHandlers` method
4. Add tests for the operation

## License

MIT

## Acknowledgments

- Model Context Protocol SDK
- QGIS Development Team
- Landscape AI Team
