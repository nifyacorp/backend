import { BaseModel } from './index.js';
import type { UserRow } from '../types/database.js';
import logger from '../utils/logger.js';

export class UserModel extends BaseModel {
  async findById(id: string): Promise<UserRow | null> {
    return this.queryOne<UserRow>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    return this.queryOne<UserRow>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
  }

  async create(data: Omit<UserRow, 'id' | 'created_at' | 'updated_at'>): Promise<UserRow> {
    const result = await this.queryOne<UserRow>(`
      INSERT INTO users (email, password_hash, name, settings)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [data.email, data.password_hash, data.name, data.settings]);

    if (!result) {
      logger.error('Failed to create user:', { data });
      throw new Error('Failed to create user');
    }

    return result;
  }

  async update(id: string, data: Partial<Omit<UserRow, 'id' | 'created_at' | 'updated_at'>>): Promise<UserRow | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        sets.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    });

    if (sets.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const sql = `
      UPDATE users 
      SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $${paramCount}
      RETURNING *
    `;

    return this.queryOne<UserRow>(sql, values);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.query<UserRow>(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );
    return result.length > 0;
  }
}