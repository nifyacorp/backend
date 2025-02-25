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
    npm prune --production && \
    npm cache clean --force

# Copy app source
COPY . .

# Set environment variables
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

# Start the application
CMD ["node", "src/index.js"]