import type { Pool as PgPool } from 'pg';
import pkg from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import logger from '../utils/logger.js';
import type { initConfig } from '../config/index.js';
import { runDiagnostics } from './diagnostics.js';

const { Pool } = pkg as unknown as { Pool: new (config: any) => PgPool };

export class DatabaseManager {
  private pool: PgPool;
  private config: Awaited<ReturnType<typeof initConfig>>;

  constructor(config: Awaited<ReturnType<typeof initConfig>>) {
    this.config = config;
    logger.info('Creating database pool with config:', {
      database: config.DB_NAME,
      user: config.DB_USER,
      socketPath: process.env.DB_SOCKET_PATH || '/cloudsql/delta-entity-447812-p2:us-central1:delta-entity-447812-db',
      maxConnections: 20,
      idleTimeout: '60 seconds',
      connectionTimeout: '5 seconds'
    });

    this.pool = new Pool({
      host: process.env.DB_SOCKET_PATH || '/cloudsql/delta-entity-447812-p2:us-central1:delta-entity-447812-db',
      database: config.DB_NAME || 'nifya',
      user: config.DB_USER,
      password: config.DB_PASSWORD,
      // Use Unix domain socket
      ssl: false,
      // Connection pool configuration
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 60000, // Close idle clients after 1 minute
      connectionTimeoutMillis: 20000, // Increase timeout for initial connection
    });

    // Handle pool errors
    this.pool.on('error', (err: Error) => {
      logger.error('Pool error occurred:', {
        error: err.message,
        stack: err.stack,
        code: (err as any).code,
        detail: (err as any).detail,
        hint: (err as any).hint
      });
      process.exit(-1);
    });

    // Add pool event listeners for debugging
    this.pool.on('connect', () => {
      logger.info('New client connected to pool');
    });

    this.pool.on('acquire', () => {
      logger.debug('Client acquired from pool', {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount
      });
    });

    this.pool.on('remove', () => {
      logger.debug('Client removed from pool', {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount
      });
    });
  }

  private async checkConnection(): Promise<void> {
    logger.info('Attempting to check database connection...');
    const client = await this.pool.connect();
    logger.info('Successfully acquired client from pool');
    try {
      const startTime = Date.now();
      const result = await client.query('SELECT version(), current_database(), current_user');
      const endTime = Date.now();

      logger.info('Database connection details:', {
        version: result.rows[0].version,
        database: result.rows[0].current_database,
        user: result.rows[0].current_user,
        connectionTime: `${endTime - startTime}ms`,
        poolState: {
          totalCount: this.pool.totalCount,
          idleCount: this.pool.idleCount,
          waitingCount: this.pool.waitingCount,
        },
      });
    } finally {
      client.release();
    }
  }

  async init(): Promise<void> {
    try {
      logger.info('Starting database initialization...');
      logger.info('Checking connection before schema application...');
      await this.checkConnection();
      logger.info('Connection check successful');

      // Apply initial schema if needed
      logger.info('Beginning schema application...');
      await this.applySchema();
      logger.info('Schema application completed');

      logger.info('Database initialization completed successfully');
    } catch (error) {
      logger.error('Failed to initialize database connection:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        database: this.config.DB_NAME,
      });
      throw error;
    }
  }

  private async applySchema(): Promise<void> {
    logger.info('Attempting to acquire client for schema application...');
    const client = await this.pool.connect();
    logger.info('Successfully acquired client for schema application');
    try {
      // Check if schema already exists
      logger.info('Checking if users table exists...');
      const tableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'users'
        );
      `);
      logger.info('Table existence check result:', { exists: tableExists.rows[0].exists });

      if (!tableExists.rows[0].exists) {
        logger.info('Users table does not exist, beginning schema creation...');
        await client.query('BEGIN');
        logger.info('Transaction started');

        const schemaSQL = readFileSync(
          join(process.cwd(), 'dist/database/migrations/20250123130842_wooden_coast.sql'),
          'utf-8'
        );
        logger.info('Schema SQL file loaded successfully');

        await client.query(schemaSQL);
        logger.info('Schema SQL executed successfully');
        await client.query('COMMIT');
        logger.info('Transaction committed');
        
        logger.info('Initial schema applied successfully');
      } else {
        logger.info('Schema already exists, skipping initialization');
      }
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to apply schema:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      client.release();
    }
  }

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const client = await this.pool.connect();
    const startTime = Date.now();
    try {
      const result = await client.query(sql, params);
      const endTime = Date.now();
      logger.debug('Query executed:', {
        sql,
        params,
        rowCount: result.rowCount,
        executionTime: `${endTime - startTime}ms`,
      });
      return result.rows as T[];
    } catch (error) {
      logger.error('Database query failed:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        sql,
        params,
        database: this.config.DB_NAME,
      });
      throw error;
    } finally {
      client.release();
    }
  }

  async end(): Promise<void> {
    await this.pool.end();
    logger.info('Database connection pool closed');
  }
}