/**
 * Documentation Index
 * 
 * This file re-exports all API documentation utilities for easier imports
 * throughout the codebase.
 */

export { enhancedOpenAPIConfig, setupAdditionalDocs } from './api-docs.js';
export { 
  getAllEndpoints, 
  getEndpointMetadata, 
  findRelatedEndpoints 
} from './apiMetadata.js';

// Note: More documentation utilities will be added here as needed 