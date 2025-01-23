import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import pkg from 'pg';
import dns from 'dns';
import { promisify } from 'util';
import logger from '../utils/logger.js';

const { Pool } = pkg;
const lookup = promisify(dns.lookup);

async function getSecret(name: string): Promise<string> {
  const client = new SecretManagerServiceClient();
  try {
    const [version] = await client.accessSecretVersion({
      name: `projects/delta-entity-447812-p2/secrets/${name}/versions/latest`,
    });
    return version.payload?.data?.toString() || '';
  } catch (error) {
    logger.error(`Failed to fetch secret: ${name}`, error);
    throw error;
  }
}

async function checkSecrets(): Promise<void> {
  logger.info('Testing Secret Manager access...');
  try {
    const [dbHost, dbPort] = await Promise.all([
      getSecret('DB_HOST'),
      getSecret('DB_PORT'),
    ]);
    logger.info('Successfully retrieved secrets:', {
      dbHost,
      dbPort,
    });
  } catch (error) {
    logger.error('Secret Manager test failed:', error);
    throw error;
  }
}

async function checkDNS(host: string): Promise<void> {
  logger.info('Testing DNS resolution...');
  try {
    const { address, family } = await lookup(host);
    logger.info('DNS resolution successful:', {
      host,
      resolvedIP: address,
      ipVersion: `IPv${family}`,
    });
  } catch (error) {
    logger.error('DNS resolution failed:', error);
    throw error;
  }
}

async function checkTCPConnection(host: string, port: number): Promise<void> {
  logger.info('Testing TCP connection...');
  const pool = new Pool({
    host,
    port,
    user: 'postgres',
    password: await getSecret('DB_PASSWORD'),
    database: 'postgres',
    connectionTimeoutMillis: 30000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    // Add retry logic
    max: 3,
    idleTimeoutMillis: 30000
  });

  try {
    await pool.connect();
    logger.info('TCP connection successful');
  } catch (error) {
    logger.error('TCP connection failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

async function checkDatabaseConnection(): Promise<void> {
  logger.info('Testing full database connection...');
  
  const [dbName, dbUser, dbPassword] = await Promise.all([
    getSecret('DB_NAME'),
    getSecret('DB_USER'),
    getSecret('DB_PASSWORD'),
  ]);

  const pool = new Pool({
    host: '/cloudsql/delta-entity-447812-p2:us-central1:delta-entity-447812-db',
    database: dbName,
    user: dbUser,
    password: dbPassword,
    ssl: false,
    connectionTimeoutMillis: 5000,
    max: 1,
    idleTimeoutMillis: 5000
  });

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT version()');
    logger.info('Database connection successful:', {
      version: result.rows[0].version,
    });
    client.release();
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

export async function runDiagnostics(): Promise<void> {
  try {
    // Test database connection using Cloud SQL socket
    await checkDatabaseConnection();

    logger.info('All diagnostics completed successfully');
  } catch (error) {
    logger.error('Diagnostics failed:', error);
    throw error;
  }
}