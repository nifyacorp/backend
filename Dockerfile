# Use Node.js 20 as the base image
FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Build TypeScript code
RUN npm run build

# Clean up dev dependencies
RUN npm prune --production

# Set production environment
ENV NODE_ENV=production

# Expose Cloud Run default port
EXPOSE 8080
ENV PORT=8080

# Start production server
CMD [ "npm", "start" ]