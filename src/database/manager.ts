import type { Pool as PgPool } from 'pg';
import pkg from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import logger from '../utils/logger.js';
import type { initConfig } from '../config/index.js';
import { runDiagnostics } from './diagnostics.js';
import { promisify } from 'util';

const { Pool } = pkg as unknown as { Pool: new (config: any) => PgPool };

export class DatabaseManager {
  private pool: PgPool;
  private config: Awaited<ReturnType<typeof initConfig>>;

  constructor(config: Awaited<ReturnType<typeof initConfig>>) {
    this.config = config;
    logger.info('Initializing database connection with config:', {
      database: config.DB_NAME,
      user: config.DB_USER,
    });

    this.pool = new Pool({
      host: '/cloudsql/delta-entity-447812-p2:us-central1:delta-entity-447812-db',
      database: config.DB_NAME || 'nifya',
      user: config.DB_USER,
      password: config.DB_PASSWORD,
      // Use Unix domain socket
      ssl: false,
      // Connection pool configuration
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 60000, // Close idle clients after 1 minute
      connectionTimeoutMillis: 5000,
    });

    // Handle pool errors
    this.pool.on('error', (err: Error) => {
      logger.error('Unexpected error on idle client', err);
      process.exit(-1);
    });
  }

  private async checkConnection(): Promise<void> {
    const client = await this.pool.connect();
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

      // Apply initial schema if needed
      await this.applySchema();

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
    const client = await this.pool.connect();
    try {
      // Check if schema already exists
      const tableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'users'
        );
      `);

      if (!tableExists.rows[0].exists) {
        await client.query('BEGIN');

        const schemaSQL = readFileSync(
          join(process.cwd(), 'dist/database/migrations/20250123130842_wooden_coast.sql'),
          'utf-8'
        );

        await client.query(schemaSQL);
        await client.query('COMMIT');
        
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