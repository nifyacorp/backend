import { getAllEndpoints, getEndpointMetadata, findRelatedEndpoints } from '../../shared/utils/apiMetadata.js';

/**
 * API Explorer service provides endpoints for API discovery and documentation
 */
export default {
  /**
   * Get API health status and overview of available endpoints
   */
  getApiHealth() {
    const startTime = process.uptime();
    const uptime = formatUptime(startTime);
    
    return {
      status: 'healthy',
      version: process.env.API_VERSION || '1.0.0',
      environment: process.env.NODE_ENV,
      uptime,
      api: {
        base_url: process.env.API_BASE_URL || 'https://api.nifya.app',
        documentation_url: 'https://docs.nifya.app',
        endpoints_count: getAllEndpoints().length,
        endpoint_groups: [
          { name: 'Authentication', base_path: '/api/v1/auth' },
          { name: 'Subscriptions', base_path: '/api/v1/subscriptions' },
          { name: 'Notifications', base_path: '/api/v1/notifications' },
          { name: 'Settings', base_path: '/api/v1/settings' },
        ]
      }
    };
  },
  
  /**
   * Get list of all available API endpoints
   */
  getAllEndpoints() {
    return {
      endpoints: getAllEndpoints(),
      count: getAllEndpoints().length,
      documentation_url: 'https://docs.nifya.app'
    };
  },
  
  /**
   * Get detailed documentation for a specific endpoint
   */
  getEndpointDocumentation(path, method) {
    const metadata = getEndpointMetadata(path, method);
    
    if (!metadata) {
      return {
        error: {
          message: 'Endpoint documentation not found',
          available_endpoints: findRelatedEndpoints(path)
        }
      };
    }
    
    return {
      documentation: metadata,
      related_endpoints: findRelatedEndpoints(path)
    };
  }
};

/**
 * Format uptime into a human-readable string
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / (3600 * 24));
  seconds -= days * 3600 * 24;
  const hours = Math.floor(seconds / 3600);
  seconds -= hours * 3600;
  const minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;
  
  return `${days}d ${hours}h ${minutes}m ${Math.floor(seconds)}s`;
} 