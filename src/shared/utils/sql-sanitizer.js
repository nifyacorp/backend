/**
 * Utility functions for sanitizing SQL queries before logging
 */

// List of parameter names that might contain sensitive data
const SENSITIVE_PARAM_PATTERNS = [
  /password/i,
  /secret/i,
  /api[_-]?key/i,
  /auth[_-]?token/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /private[_-]?key/i
];

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
  
  // Mask potential sensitive data in SQL
  sanitized = sanitized
    .replace(/password\s*=\s*['"][^'"]*['"]/gi, 'password=*****')
    .replace(/api_key\s*=\s*['"][^'"]*['"]/gi, 'api_key=*****')
    .replace(/secret\s*=\s*['"][^'"]*['"]/gi, 'secret=*****')
    .replace(/token\s*=\s*['"][^'"]*['"]/gi, 'token=*****')
    .replace(/key\s*=\s*['"][^'"]*['"]/gi, 'key=*****');
  
  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '...';
  }
  
  return sanitized;
}

/**
 * Checks if a parameter name matches any sensitive patterns
 * @param {string} paramName - The parameter name to check
 * @returns {boolean} - True if the parameter name matches a sensitive pattern
 */
function isSensitiveParameter(paramName) {
  return SENSITIVE_PARAM_PATTERNS.some(pattern => pattern.test(paramName));
}

/**
 * Sanitizes query parameters for logging
 * @param {Array} params - Query parameters
 * @returns {Array} - Sanitized parameters
 */
export function sanitizeParamsForLogging(params) {
  if (!params || !Array.isArray(params)) return [];
  
  return params.map((param, index) => {
    // Check if this parameter position typically contains sensitive data
    // based on common SQL patterns
    const isSensitive = param && typeof param === 'string' && (
      param.length > 20 || // Long strings might be tokens
      isSensitiveParameter(String(index)) // Check if the parameter position is sensitive
    );

    if (isSensitive) {
      return '*****';
    }

    // Handle different parameter types
    if (param === null) return 'null';
    if (param === undefined) return 'undefined';
    if (param instanceof Date) return param.toISOString();
    if (Array.isArray(param)) {
      return `[Array(${param.length})]`;
    }
    if (Buffer.isBuffer(param)) {
      return `[Buffer(${param.length})]`;
    }
    if (typeof param === 'object') {
      try {
        const str = JSON.stringify(param);
        return str.length > 100 ? str.substring(0, 97) + '...' : str;
      } catch (err) {
        return '[Object]';
      }
    }
    
    // For primitive types, convert to string but limit length
    const str = String(param);
    return str.length > 100 ? str.substring(0, 97) + '...' : str;
  });
} 