import express from 'express';
import apiExplorerService from '../../../core/apiExplorer/service.js';

const router = express.Router();

/**
 * @route GET /api/health
 * @description Health check and API overview
 * @access Public
 */
router.get('/health', async (req, res) => {
  const healthInfo = apiExplorerService.getApiHealth();
  return res.json(healthInfo);
});

/**
 * @route GET /api/explorer
 * @description List all available endpoints
 * @access Public
 */
router.get('/explorer', async (req, res) => {
  const endpoints = apiExplorerService.getAllEndpoints();
  return res.json(endpoints);
});

/**
 * @route GET /api/explorer/:path
 * @description Get documentation for a specific endpoint
 * @access Public
 * @param {string} path - API path
 * @param {string} method - HTTP method (default: GET)
 */
router.get('/explorer/:path', async (req, res) => {
  let path = req.params.path;
  
  // Add leading slash if missing
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  
  // If path doesn't include version, assume v1
  if (!path.includes('/v1/') && !path.startsWith('/api/')) {
    path = `/api/v1/${path}`;
  } else if (!path.startsWith('/api/')) {
    path = `/api${path}`;
  }
  
  const method = req.query.method || 'GET';
  const documentation = apiExplorerService.getEndpointDocumentation(path, method.toUpperCase());
  
  return res.json(documentation);
});

export default router; 