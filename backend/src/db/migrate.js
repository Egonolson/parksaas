'use strict';

/**
 * ParkSaaS Migration Runner
 *
 * Applies SQL migration files from src/db/migrations/ in lexicographic order.
 * Each migration is applied exactly once (tracked in schema_migrations table).
 * The base schema.sql is always applied first if the DB is empty.
 *
 * Usage:
 *   node src/db/migrate.js            # run all pending migrations
 *   node src/db/migrate.js --status   # show migration status
 *   node src/db/migrate.js --rollback # not supported (forward-only)
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const SCHEMA_FILE = path.join(__dirname, 'schema.sql');
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const BASE_MIGRATION_VERSION = '0000_base_schema';

// Validate required env
if (!process.env.DATABASE_URL) {
  console.error('[migrate] ERROR: DATABASE_URL environment variable is not set.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
  connectionTimeoutMillis: 10000,
});

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     VARCHAR(255) PRIMARY KEY,
      applied_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query(
    'SELECT version FROM schema_migrations ORDER BY version ASC'
  );
  return new Set(result.rows.map((r) => r.version));
}

async function markMigrationApplied(client, version) {
  await client.query(
    'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING',
    [version]
  );
}

async function runSQL(client, sql, description) {
  try {
    await client.query(sql);
    console.log(`  [OK] ${description}`);
  } catch (err) {
    console.error(`  [FAIL] ${description}: ${err.message}`);
    throw err;
  }
}

async function applyBaseSchema(client, applied) {
  if (applied.has(BASE_MIGRATION_VERSION)) {
    console.log(`  [SKIP] ${BASE_MIGRATION_VERSION} (already applied)`);
    return;
  }

  console.log(`  [RUN] ${BASE_MIGRATION_VERSION}`);
  const sql = fs.readFileSync(SCHEMA_FILE, 'utf8');
  await runSQL(client, sql, 'base schema');
  await markMigrationApplied(client, BASE_MIGRATION_VERSION);
}

function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    return [];
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort(); // lexicographic = chronological if using YYYYMMDD prefix
}

async function runMigrations() {
  const client = await pool.connect();
  let migrationsApplied = 0;

  try {
    await client.query('BEGIN');

    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    console.log('\n[migrate] Applying migrations...\n');

    // Always apply base schema first
    await applyBaseSchema(client, applied);

    // Apply incremental migration files
    const files = getMigrationFiles();
    for (const file of files) {
      const version = path.basename(file, '.sql');
      if (applied.has(version)) {
        console.log(`  [SKIP] ${version} (already applied)`);
        continue;
      }

      console.log(`  [RUN]  ${version}`);
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await runSQL(client, sql, version);
      await markMigrationApplied(client, version);
      migrationsApplied++;
    }

    await client.query('COMMIT');

    if (migrationsApplied === 0 && applied.has(BASE_MIGRATION_VERSION)) {
      console.log('\n[migrate] Database is up to date. No migrations to apply.\n');
    } else {
      console.log(`\n[migrate] Done. Applied ${migrationsApplied} migration(s).\n`);
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n[migrate] Migration failed, rolled back transaction.');
    console.error('[migrate] Error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function showStatus() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);
    const files = getMigrationFiles();

    console.log('\n[migrate] Migration Status:\n');
    console.log(
      `  ${BASE_MIGRATION_VERSION.padEnd(50)} ${applied.has(BASE_MIGRATION_VERSION) ? 'APPLIED' : 'PENDING'}`
    );

    for (const file of files) {
      const version = path.basename(file, '.sql');
      const status = applied.has(version) ? 'APPLIED' : 'PENDING';
      console.log(`  ${version.padEnd(50)} ${status}`);
    }
    console.log();
  } finally {
    client.release();
  }
}

async function main() {
  const args = process.argv.slice(2);

  try {
    if (args.includes('--status')) {
      await showStatus();
    } else {
      await runMigrations();
    }
  } catch (err) {
    console.error('[migrate] Fatal error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
