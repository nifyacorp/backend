// Helper function to format uptime in a human-readable format
function formatUptime(uptime) {
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(' ');
}


// Plugin to register core health and version routes
export async function coreRoutes(fastify, options) {

  fastify.get('/health', async (request, reply) => {
    const packageVersion = process.env.npm_package_version || 'unknown';
    const buildTimestamp = process.env.BUILD_TIMESTAMP || new Date().toISOString();
    const commitSha = process.env.COMMIT_SHA || 'unknown';

    // Basic health check - consider adding database/service checks
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      uptimeFormatted: formatUptime(process.uptime()),
      version: {
        package: packageVersion,
        buildTimestamp,
        commitSha,
        environment: process.env.NODE_ENV || 'development'
      },
      memory: process.memoryUsage(),
      // services: {
      //   database: 'connected' // Example: Add check result here
      // }
    };
  });

  fastify.get('/version', async (request, reply) => {
    const packageVersion = process.env.npm_package_version || 'unknown';
    const buildTimestamp = process.env.BUILD_TIMESTAMP || new Date().toISOString();
    const commitSha = process.env.COMMIT_SHA || 'unknown';
    const deploymentId = process.env.DEPLOYMENT_ID || 'local'; // Example: Get from env

    return {
      api_version: 'v1', // Consider making this dynamic or config-based
      service: process.env.SERVICE_NAME || 'nifya-orchestration-service', // Example: Get from env
      version: packageVersion,
      build: {
        timestamp: buildTimestamp,
        commit: commitSha,
        deployment_id: deploymentId
      },
      environment: process.env.NODE_ENV || 'development',
      // features: { // Example: Define features based on config/env
      //   notifications: process.env.FEATURE_NOTIFICATIONS === 'true',
      //   subscriptions: true,
      //   templates: true
      // },
      uptime_seconds: process.uptime(),
      uptime_formatted: formatUptime(process.uptime())
    };
  });

  console.log("Core routes (/health, /version) registered.");
} 