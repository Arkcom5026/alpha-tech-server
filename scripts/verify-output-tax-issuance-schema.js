'use strict';

const { Client } = require('pg');
const dotenv = require('dotenv');
const { assertTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority');

dotenv.config({ path: '.env.restore', override: false });

const target = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
const authorityEnv = { ...process.env };
delete authorityEnv.DATABASE_URL;
delete authorityEnv.DIRECT_URL;
assertTestDatabaseAuthority({ targetUrl: target, env: authorityEnv });

const requiredColumns = [
  'taxInvoiceKind',
  'issuerProfileId',
  'issuedDocumentNumber',
  'issuedSequence',
  'issuerSnapshot',
  'recipientSnapshot',
];
const requiredIndexes = [
  'TaxDocument_issuerProfileId_idx',
  'TaxDocument_issuer_kind_sequence_key',
  'TaxDocument_issuer_kind_number_key',
];

const main = async () => {
  const url = new URL(target);
  url.searchParams.delete('sslmode');
  const client = new Client({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const columns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'TaxDocument'
    `);
    const indexes = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'TaxDocument'
    `);
    const migrations = await client.query(`
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE migration_name = '20260803203000_output_tax_atomic_issuance'
        AND finished_at IS NOT NULL
        AND rolled_back_at IS NULL
    `);
    await client.query('COMMIT');

    const columnSet = new Set(columns.rows.map((row) => row.column_name));
    const indexSet = new Set(indexes.rows.map((row) => row.indexname));
    const missingColumns = requiredColumns.filter((name) => !columnSet.has(name));
    const missingIndexes = requiredIndexes.filter((name) => !indexSet.has(name));
    const migrationApplied = migrations.rows.length === 1;
    const result = !missingColumns.length && !missingIndexes.length && migrationApplied ? 'PASS' : 'FAIL';

    console.log(JSON.stringify({
      result,
      databaseModified: false,
      authority: {
        host: new URL(target).hostname,
        port: new URL(target).port || '5432',
        database: new URL(target).pathname.replace(/^\//, ''),
      },
      migrationApplied,
      missingColumns,
      missingIndexes,
    }, null, 2));

    process.exitCode = result === 'PASS' ? 0 : 2;
  } finally {
    await client.end();
  }
};

main().catch((error) => {
  console.error(`OUTPUT_TAX_ISSUANCE_SCHEMA_AUDIT_FAILED: ${error.message}`);
  process.exitCode = 1;
});
