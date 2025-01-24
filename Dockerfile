# Use the official Node.js image
FROM node:20-slim

# Install the Cloud SQL Auth proxy
RUN apt-get update && apt-get install -y wget && \
    wget https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.1/cloud-sql-proxy.linux.amd64 -O /cloud-sql-proxy && \
    chmod +x /cloud-sql-proxy

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app source
COPY . .

# Expose port
EXPOSE 3000

# Start the application with Cloud SQL proxy
CMD /cloud-sql-proxy \
    --unix-socket /cloudsql \
    delta-entity-447812-p2:us-central1:nifya-db & \
    npm start