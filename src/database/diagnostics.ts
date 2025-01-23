import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { Pool } from 'pg';
import dns from 'dns';
import { promisify } from 'util';
import logger from '../utils/logger.js';

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
    password: 'test',
    database: 'postgres',
    connectionTimeoutMillis: 5000,
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
  
  const [
    dbHost,
    dbPort,
    dbName,
    dbUser,
    dbPassword,
  ] = await Promise.all([
    getSecret('DB_HOST'),
    getSecret('DB_PORT'),
    getSecret('DB_NAME'),
    getSecret('DB_USER'),
    getSecret('DB_PASSWORD'),
  ]);

  const pool = new Pool({
    host: dbHost,
    port: parseInt(dbPort, 10),
    database: dbName,
    user: dbUser,
    password: dbPassword,
    ssl: false,
    connectionTimeoutMillis: 5000,
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
    // Step 1: Check Secret Manager access
    await checkSecrets();

    // Step 2: Get database host for further tests
    const dbHost = await getSecret('DB_HOST');
    const dbPort = parseInt(await getSecret('DB_PORT'), 10);

    // Step 3: Check DNS resolution
    await checkDNS(dbHost);

    // Step 4: Check TCP connection
    await checkTCPConnection(dbHost, dbPort);

    // Step 5: Check full database connection
    await checkDatabaseConnection();

    logger.info('All diagnostics completed successfully');
  } catch (error) {
    logger.error('Diagnostics failed:', error);
    throw error;
  }
}