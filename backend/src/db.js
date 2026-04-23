'use strict';

const { Pool } = require('pg');
const logger = require('./utils/logger');

let pool;

/**
 * Initializes the PostgreSQL connection pool.
 * Called once at server startup.
 */
function initPool() {
  if (pool) return pool;

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000', 10),
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
  });

  pool.on('connect', () => {
    logger.debug('New DB client connected');
  });

  pool.on('error', (err) => {
    logger.error('Unexpected DB pool error', { error: err.message, stack: err.stack });
  });

  return pool;
}

/**
 * Returns the singleton pool instance.
 */
function getPool() {
  if (!pool) {
    throw new Error('Database pool has not been initialized. Call initPool() first.');
  }
  return pool;
}

/**
 * Tests connectivity by running a simple query.
 * @throws if the connection fails
 */
async function testConnection() {
  const client = await getPool().connect();
  try {
    const result = await client.query('SELECT NOW() AS now, current_database() AS db');
    logger.info('Database connection verified', {
      db: result.rows[0].db,
      serverTime: result.rows[0].now,
    });
  } finally {
    client.release();
  }
}

/**
 * Gracefully drains the pool.
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
}

/**
 * Executes a parameterized query via the pool.
 * @param {string} text - SQL query
 * @param {any[]} [params] - Query parameters
 */
async function query(text, params) {
  const start = Date.now();
  const result = await getPool().query(text, params);
  const duration = Date.now() - start;
  logger.debug('DB query executed', { duration, rows: result.rowCount });
  return result;
}

/**
 * Runs a callback within a transaction.
 * Automatically commits on success and rolls back on error.
 * @param {(client: import('pg').PoolClient) => Promise<T>} callback
 * @returns {Promise<T>}
 */
async function withTransaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  initPool,
  getPool,
  testConnection,
  closePool,
  query,
  withTransaction,
};
