/**
 * Utility functions for sanitizing SQL queries before logging
 */

/**
 * Sanitizes a SQL query by:
 * 1. Removing extra whitespace
 * 2. Truncating long queries
 * 3. Masking sensitive data
 * @param {string} sql - The SQL query to sanitize
 * @param {number} maxLength - Maximum length for truncation
 * @returns {string} - Sanitized SQL query
 */
export function sanitizeSqlForLogging(sql, maxLength = 1000) {
  if (!sql) return '';
  
  // Remove extra whitespace and newlines
  let sanitized = sql.replace(/\s+/g, ' ').trim();
  
  // Mask potential sensitive data
  sanitized = sanitized
    .replace(/password\s*=\s*['"][^'"]*['"]/gi, 'password=*****')
    .replace(/api_key\s*=\s*['"][^'"]*['"]/gi, 'api_key=*****')
    .replace(/secret\s*=\s*['"][^'"]*['"]/gi, 'secret=*****');
  
  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '...';
  }
  
  return sanitized;
}

/**
 * Sanitizes query parameters for logging
 * @param {Array} params - Query parameters
 * @returns {Array} - Sanitized parameters
 */
export function sanitizeParamsForLogging(params) {
  if (!params || !Array.isArray(params)) return [];
  
  return params.map(param => {
    // Handle different parameter types
    if (param === null) return 'null';
    if (param === undefined) return 'undefined';
    if (typeof param === 'object') {
      if (param instanceof Date) return param.toISOString();
      // For objects, stringify but limit length
      return JSON.stringify(param).substring(0, 100);
    }
    // For primitive types, convert to string
    return String(param);
  });
} 