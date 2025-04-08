# Use the official Node.js image
FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install production dependencies for Google Cloud SQL
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies and generate lock file
RUN npm install --no-audit --no-fund && \
    npm install @fastify/express winston winston-elasticsearch && \
    npm prune --production && \
    npm cache clean --force

# Copy app source
COPY . .

# Create log directory
RUN mkdir -p logs && \
    chmod 777 logs

# Define build arguments
ARG BUILD_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
ARG COMMIT_SHA=unknown
ARG DEPLOYMENT_ID=local

# Set environment variables
ENV NODE_ENV=production
ENV BUILD_TIMESTAMP=${BUILD_TIMESTAMP}
ENV COMMIT_SHA=${COMMIT_SHA}
ENV DEPLOYMENT_ID=${DEPLOYMENT_ID}
ENV PORT=8080
ENV HOST=0.0.0.0

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-8080}/health || exit 1

# Start the application
CMD ["node", "src/index.js"]