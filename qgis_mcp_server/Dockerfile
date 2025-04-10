FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Create data and output directories
RUN mkdir -p data output

# Set environment variables
ENV NODE_ENV=production
ENV QGIS_SERVER_URL=http://qgis:5000
ENV QGIS_DATA_DIR=/app/data
ENV QGIS_OUTPUT_DIR=/app/output

# Expose port
EXPOSE 5000

# Start the server
CMD ["node", "src/index.js"] 