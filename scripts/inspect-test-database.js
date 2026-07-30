'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');
const { assertTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority');

const envPath = path.join(process.cwd(), '.env.restore');
if (!fs.existsSync(envPath)) {
  throw new Error('Missing .env.restore. Copy .env.restore.example and configure the dedicated Test DB.');
}

dotenv.config({ path: envPath, override: true });

const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
const authority = assertTestDatabaseAuthority({ targetUrl, env: process.env });

function pgConfig(connectionString) {
  const url = new URL(connectionString);
  url.searchParams.delete('sslmode');
  return {
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  };
}

async function queryMigrations(client) {
  const exists = await client.query("SELECT to_regclass('public.\"_prisma_migrations\"') AS migration_table");
  if (!exists.rows[0].migration_table) {
    return { tablePresent: false, applied: [] };
  }

  const rows = await client.query(
    'SELECT migration_name, finished_at IS NOT NULL AS applied, rolled_back_at IS NOT NULL AS rolled_back ' +
    'FROM "_prisma_migrations" ORDER BY started_at ASC'
  );

  return {
    tablePresent: true,
    applied: rows.rows.filter((row) => row.applied && !row.rolled_back).map((row) => row.migration_name),
    incomplete: rows.rows.filter((row) => !row.applied || row.rolled_back).map((row) => row.migration_name),
  };
}

async function main() {
  const client = new Client(pgConfig(targetUrl));
  await client.connect();

  try {
    await client.query('BEGIN READ ONLY');

    const readOnly = await client.query('SHOW transaction_read_only');
    const identity = await client.query('SELECT current_database() AS database_name, current_schema() AS schema_name');
    const version = await client.query('SHOW server_version');
    const tableCount = await client.query(
      "SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
    );
    const migrations = await queryMigrations(client);
    const partnerTables = await client.query(
      "SELECT " +
      "to_regclass('public.\"PartnerStoreCapability\"') IS NOT NULL AS capability, " +
      "to_regclass('public.\"PartnerStoreApplication\"') IS NOT NULL AS application"
    );

    console.log(JSON.stringify({
      result: 'PASS',
      authority: authority.target,
      transactionReadOnly: readOnly.rows[0].transaction_read_only === 'on',
      postgresVersion: version.rows[0].server_version,
      schema: identity.rows[0].schema_name,
      tableCount: tableCount.rows[0].count,
      migrationLedger: migrations,
      partnerStoreTables: partnerTables.rows[0],
    }, null, 2));

    await client.query('COMMIT');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`TEST_DATABASE_INSPECTION_FAILED: ${error.message || error}`);
  process.exitCode = 1;
});
