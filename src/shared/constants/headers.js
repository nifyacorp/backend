/**
 * Standardized header constants
 * This file contains all the HTTP header names used across the application
 * to ensure consistency between frontend and backend
 */

// Authentication headers
export const AUTH_HEADER = 'Authorization';
export const USER_ID_HEADER = 'x-user-id';

// Standard request headers
export const CONTENT_TYPE = 'Content-Type';
export const ACCEPT = 'Accept';
export const X_REQUESTED_WITH = 'X-Requested-With';

// CORS related collections
export const ALLOWED_HEADERS = [
  AUTH_HEADER,
  USER_ID_HEADER,
  CONTENT_TYPE,
  ACCEPT,
  X_REQUESTED_WITH,
  'headers' // Add the 'headers' field to allow it in preflight requests
];

// Content type values
export const JSON_CONTENT_TYPE = 'application/json';

// Auth token utilities
export const TOKEN_PREFIX = 'Bearer ';
export const formatBearerToken = (token) => 
  token.startsWith(TOKEN_PREFIX) ? token : `${TOKEN_PREFIX}${token}`; 