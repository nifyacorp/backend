import pkg from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import logger from '../utils/logger.js';
import dns from 'dns';
import { promisify } from 'util';
const { Pool } = pkg;
const { Pool } = pg;
const lookup = promisify(dns.lookup);
export class DatabaseManager {
    pool;
    config;
    constructor(config) {
        this.config = config;
        logger.info('Initializing database connection with config:', {
            host: config.DB_HOST,
            port: config.DB_PORT,
            database: config.DB_NAME,
            user: config.DB_USER,
            instance: config.DB_INSTANCE_CONNECTION_NAME,
        });
        this.pool = new Pool({
            host: config.DB_HOST,
            port: config.DB_PORT,
            database: config.DB_NAME || 'nifya',
            user: config.DB_USER,
            password: config.DB_PASSWORD,
            // Cloud SQL doesn't require SSL for internal connections
            ssl: false,
            // Connection pool configuration
            max: 20, // Maximum number of clients in the pool
            idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
            connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
        });
        // Handle pool errors
        this.pool.on('error', (err) => {
            logger.error('Unexpected error on idle client', err);
            process.exit(-1);
        });
    }
    async checkDNS() {
        try {
            const { address, family } = await lookup(this.config.DB_HOST);
            logger.info('DNS resolution successful:', {
                host: this.config.DB_HOST,
                resolvedIP: address,
                ipVersion: `IPv${family}`,
            });
        }
        catch (error) {
            logger.error('DNS resolution failed:', {
                host: this.config.DB_HOST,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    async checkConnection() {
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
        }
        finally {
            client.release();
        }
    }
    async init() {
        try {
            logger.info('Starting database initialization...');
            // Check DNS resolution
            await this.checkDNS();
            // Test basic connection and get server details
            await this.checkConnection();
            // Apply initial schema if needed
            await this.applySchema();
            logger.info('Database initialization completed successfully');
        }
        catch (error) {
            logger.error('Failed to initialize database connection:', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                host: this.config.DB_HOST,
                database: this.config.DB_NAME,
                instance: this.config.DB_INSTANCE_CONNECTION_NAME,
            });
            throw error;
        }
    }
    async applySchema() {
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
                const schemaSQL = readFileSync(join(process.cwd(), 'dist/database/migrations/20250123130842_wooden_coast.sql'), 'utf-8');
                await client.query(schemaSQL);
                await client.query('COMMIT');
                logger.info('Initial schema applied successfully');
            }
            else {
                logger.info('Schema already exists, skipping initialization');
            }
        }
        catch (error) {
            await client.query('ROLLBACK');
            logger.error('Failed to apply schema:', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
        finally {
            client.release();
        }
    }
    async query(sql, params) {
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
            return result.rows;
        }
        catch (error) {
            logger.error('Database query failed:', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                sql,
                params,
                host: this.config.DB_HOST,
                database: this.config.DB_NAME,
            });
            throw error;
        }
        finally {
            client.release();
        }
    }
    async end() {
        await this.pool.end();
        logger.info('Database connection pool closed');
    }
}
