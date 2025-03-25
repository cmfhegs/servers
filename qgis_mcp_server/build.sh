#!/bin/bash
# Build script for QGIS MCP Server
# This script compiles the TypeScript code and prepares the server for deployment

# Exit on any error
set -e

echo "Building QGIS MCP Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    echo "Please install Node.js 16.x or later"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed"
    echo "Please install npm"
    exit 1
fi

# Install dependencies if node_modules doesn't exist or package.json has changed
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Create build directory if it doesn't exist
if [ ! -d "build" ]; then
    mkdir build
fi

# Install TypeScript if not installed
if ! command -v tsc &> /dev/null && ! [ -f "node_modules/.bin/tsc" ]; then
    echo "Installing TypeScript..."
    npm install --save-dev typescript
fi

# Build the project
echo "Compiling TypeScript..."
npm run build

# Set execute permissions on the main file
if [ -f "build/index.js" ]; then
    chmod +x build/index.js
    echo "Set execute permissions on build/index.js"
fi

# Check if build was successful
if [ -f "build/index.js" ]; then
    echo "Build completed successfully!"
    echo "The server can now be started with: node build/index.js"
else
    echo "Error: Build failed - build/index.js not found"
    exit 1
fi

echo "Done!"
