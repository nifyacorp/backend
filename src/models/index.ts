import { DatabaseManager } from '../database/manager.js';
import type { QueryResultRow } from 'pg';
import logger from '../utils/logger.js';

export class BaseModel {
  protected db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  protected async query<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<T[]> {
    try {
      return await this.db.query<T>(sql, params);
    } catch (error) {
      logger.error('Model query failed:', {
        error: error instanceof Error ? error.message : String(error),
        sql,
        params,
      });
      throw error;
    }
  }

  protected async queryOne<T extends QueryResultRow>(sql: string, params?: unknown[]): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results[0] || null;
  }
}