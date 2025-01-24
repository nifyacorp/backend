import type { Pool as PgPool } from 'pg';
import pkg from 'pg';
import logger from '../utils/logger.js';
import { runDiagnostics } from './diagnostics.js';

const { Pool } = pkg as unknown as { Pool: new (config: any) => PgPool };

export class DatabaseManager {
  private pool: PgPool;

  constructor() {
    const instanceConnectionName = 'delta-entity-447812-p2:us-central1:delta-entity-447812-db';
    
    logger.info('Initializing database manager:', {
      user: 'postgres',
      database: 'nifya',
      host: `/cloudsql/${instanceConnectionName}`,
      max: 5
    });

    this.pool = new Pool({
      user: 'postgres',
      database: 'nifya',
      host: `/cloudsql/${instanceConnectionName}`,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 20000
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
      process.exit(-1);
    });
  }

  async init(): Promise<void> {
    logger.info('Starting database initialization...');
    
    try {
      // Run comprehensive diagnostics
      await runDiagnostics();
      
      // Verify schema exists
      await this.verifySchema();
      
      logger.info('Database initialization completed successfully');
    } catch (error) {
      logger.error('Database initialization failed:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  private async verifySchema(): Promise<void> {
    logger.info('Verifying database schema...');
    
    const tables = [
      'users',
      'subscriptions',
      'notifications',
      'activity_logs',
      'subscription_templates',
      'feedback'
    ];
    
    for (const table of tables) {
      const result = await this.query<{ exists: boolean }>(
        'SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)',
        [table]
      );
      
      if (!result[0].exists) {
        logger.error(`Required table "${table}" does not exist`);
        throw new Error(`Required table "${table}" does not exist`);
      }
      
      logger.info(`Verified table "${table}" exists`);
    }
    
    logger.info('Schema verification completed successfully');
  }

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    logger.debug('Executing query:', { sql, params });
    const client = await this.pool.connect();
    const startTime = Date.now();
    try {
      const result = await client.query(sql, params);
      const duration = Date.now() - startTime;
      logger.debug('Query completed:', {
        sql,
        params,
        rowCount: result.rowCount,
        duration: `${duration}ms`
      });
      return result.rows as T[];
    } catch (error) {
      logger.error('Query failed:', {
        sql,
        params,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    } finally {
      client.release();
    }
  }

  async checkConnection(): Promise<void> {
    logger.info('Checking database connection...');
    const startTime = Date.now();
    try {
      const result = await this.query('SELECT version(), current_database(), current_user');
      const duration = Date.now() - startTime;
      logger.info('Database connection successful:', {
        version: result[0].version,
        database: result[0].current_database as string,
        user: result[0].current_user as string,
        duration: `${duration}ms`,
        poolState: this.getPoolState()
      });
    } catch (error) {
      logger.error('Database connection check failed:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  private getPoolState(): { totalCount: number; idleCount: number; waitingCount: number } {
    const poolState = this.pool as unknown as {
      totalCount: number;
      idleCount: number;
      waitingCount: number;
    };

    return {
          totalCount: poolState.totalCount,
          idleCount: poolState.idleCount,
          waitingCount: poolState.waitingCount
    };
  }

  async end(): Promise<void> {
    logger.info('Closing database connection pool...');
    await this.pool.end();
    logger.info('Database connection pool closed');
  }
}