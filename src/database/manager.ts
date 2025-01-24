import type { Pool as PgPool } from 'pg';
import pkg from 'pg';
import logger from '../utils/logger.js';

const { Pool } = pkg as unknown as { Pool: new (config: any) => PgPool };

export class DatabaseManager {
  private pool: PgPool;

  constructor() {
    const instanceConnectionName = 'delta-entity-447812-p2:us-central1:delta-entity-447812-db';
    
    this.pool = new Pool({
      user: 'postgres',
      database: 'nifya',
      host: `/cloudsql/${instanceConnectionName}`,
      max: 5
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
      process.exit(-1);
    });
  }

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(sql, params);
      return result.rows as T[];
    } finally {
      client.release();
    }
  }

  async end(): Promise<void> {
    await this.pool.end();
  }
}