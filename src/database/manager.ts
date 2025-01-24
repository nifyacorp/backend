import type { Pool as PgPool } from 'pg';
import pkg from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import logger from '../utils/logger.js';
import type { Config } from '../config/index.js';

const { Pool } = pkg as unknown as { Pool: new (config: any) => PgPool };

export class DatabaseManager {
  private pool: PgPool;

  constructor(config: Config) {
    logger.info('Initializing database connection');

    // Cloud SQL Unix Domain Socket path
    const instanceConnectionName = 'delta-entity-447812-p2:us-central1:delta-entity-447812-db';

    this.pool = new Pool({
      host: '/cloudsql',
      database: 'nifya',
      user: 'postgres',
      ssl: false,
      // Required for Cloud SQL Unix domain socket
      options: `--project=delta-entity-447812-p2 --instance=${instanceConnectionName}`,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 20000,
      keepAlive: true
    });

    // Handle pool errors
    this.pool.on('error', (err: Error) => {
      logger.error('Pool error occurred:', {
        error: err.message,
        stack: err.stack
      });
      process.exit(-1);
    });

    this.pool.on('connect', () => {
      logger.info('New client connected to pool');
    });
  }

  private async checkConnection(): Promise<void> {
    const client = await this.pool.connect();
    try {
      const result = await client.query('SELECT version(), current_database(), current_user');
      logger.info('Database connection details:', {
        version: result.rows[0].version,
        database: result.rows[0].current_database,
        user: result.rows[0].current_user,
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
      await this.checkConnection();
      await this.applySchema();
      logger.info('Database initialization completed successfully');
    } catch (error) {
      logger.error('Failed to initialize database connection:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  private async applySchema(): Promise<void> {
    const client = await this.pool.connect();
    try {
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
    try {
      const result = await client.query(sql, params);
      return result.rows as T[];
    } catch (error) {
      logger.error('Database query failed:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        sql,
        params
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