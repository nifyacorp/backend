/**
 * Single Schema Migration System for NIFYA backend
 * 
 * This is a simplified migration system that uses a single schema file
 * instead of multiple incremental migrations.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, pool } from './client.js';
import { AppError } from '../../shared/errors/AppError.js';
import { logRequest, logError } from '../../shared/logging/logger.js';

// Get the current module's directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to schema file (new consolidated schema file)
const SCHEMA_FILE = path.join(__dirname, '../../../consolidated-schema.sql');

// Migration error types
const MIGRATION_ERRORS = {
  SCHEMA_FILE_MISSING: {
    code: 'SCHEMA_FILE_MISSING',
    message: 'Schema file not found'
  },
  EXECUTION_ERROR: {
    code: 'SCHEMA_EXECUTION_ERROR',
    message: 'Error executing schema file'
  }
};

/**
 * Apply the complete schema
 */
async function applySchema(context = {}) {
  const requestId = context.requestId || 'schema-' + Date.now();
  const schemaContext = {
    ...context,
    requestId,
    path: context.path || 'schema-application',
    method: context.method || 'APPLY'
  };
  
  try {
    logRequest(schemaContext, 'Checking schema file existence');
    
    // Check if schema file exists
    try {
      await fs.access(SCHEMA_FILE);
      logRequest(schemaContext, `Schema file found: ${SCHEMA_FILE}`);
    } catch (error) {
      logError(schemaContext, `Schema file not found: ${SCHEMA_FILE}`);
      throw new AppError(
        MIGRATION_ERRORS.SCHEMA_FILE_MISSING.code,
        `Schema file not found: ${SCHEMA_FILE}`,
        500
      );
    }
    
    // Read schema file
    const sqlContent = await fs.readFile(SCHEMA_FILE, 'utf-8');
    logRequest(schemaContext, `Read schema file (${sqlContent.length} bytes)`);
    
    // Apply schema
    logRequest(schemaContext, 'Applying schema to database');
    
    // We'll use a direct client connection rather than a transaction
    // because the schema file might contain statements that can't be in a transaction
    const client = await pool.connect();
    
    try {
      await client.query(sqlContent);
      logRequest(schemaContext, 'Schema applied successfully');
    } catch (error) {
      logError(schemaContext, 'Error applying schema:', error);
      
      // Try to extract error location
      let errorDetails = {};
      
      if (error.position) {
        const position = parseInt(error.position, 10);
        if (!isNaN(position)) {
          // Calculate line number from position
          const contentBeforeError = sqlContent.substring(0, position);
          const lines = contentBeforeError.split('\n');
          const lineNumber = lines.length;
          
          // Get the line content
          const fullLines = sqlContent.split('\n');
          const lineContent = lineNumber <= fullLines.length ? fullLines[lineNumber - 1].trim() : '';
          
          errorDetails = {
            lineNumber,
            lineContent,
            position
          };
          
          logError(schemaContext, `Error at line ${lineNumber}: ${lineContent}`);
        }
      }
      
      throw new AppError(
        MIGRATION_ERRORS.EXECUTION_ERROR.code,
        `Error applying schema: ${error.message}`,
        500,
        {
          originalError: error.message,
          code: error.code,
          detail: error.detail,
          ...errorDetails
        }
      );
    } finally {
      client.release();
      logRequest(schemaContext, 'Database client released');
    }
    
    return {
      success: true,
      message: 'Schema applied successfully'
    };
  } catch (error) {
    logError(schemaContext, 'Schema application failed:', error);
    throw error;
  }
}

/**
 * Initialize the database with schema
 */
export async function initializeMigrations(context = {}) {
  const requestId = context.requestId || 'init-' + Date.now();
  const initContext = {
    ...context,
    requestId,
    path: context.path || 'database-init',
    method: context.method || 'INIT'
  };
  
  try {
    logRequest(initContext, 'Starting database schema application...');
    await applySchema(initContext);
    logRequest(initContext, 'Database schema applied successfully');
  } catch (error) {
    logError(initContext, 'Schema application failed:', error);
    throw error;
  }
}

/**
 * Export utility functions for testing
 */
export const schemaUtils = {
  applySchema
};