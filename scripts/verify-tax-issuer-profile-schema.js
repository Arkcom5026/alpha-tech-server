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
  'id',
  'branchId',
  'legalName',
  'taxId',
  'registeredAddress',
  'branchCode',
  'isHeadOffice',
  'shortTaxInvoicePrefix',
  'fullTaxInvoicePrefix',
  'nextShortTaxInvoiceNumber',
  'nextFullTaxInvoiceNumber',
  'status',
  'createdAt',
  'updatedAt',
];

const requiredConstraints = [
  'TaxIssuerProfile_pkey',
  'TaxIssuerProfile_branchId_fkey',
  'TaxIssuerProfile_nextShortTaxInvoiceNumber_positive',
  'TaxIssuerProfile_nextFullTaxInvoiceNumber_positive',
];

const requiredIndexes = [
  'TaxIssuerProfile_branchId_key',
  'TaxIssuerProfile_status_idx',
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

    const table = await client.query(`
      SELECT to_regclass('public."TaxIssuerProfile"') AS name
    `);

    const columns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'TaxIssuerProfile'
    `);

    const constraints = await client.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public."TaxIssuerProfile"'::regclass
    `);

    const indexes = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'TaxIssuerProfile'
    `);

    await client.query('COMMIT');

    const columnSet = new Set(columns.rows.map((row) => row.column_name));
    const constraintSet = new Set(constraints.rows.map((row) => row.conname));
    const indexSet = new Set(indexes.rows.map((row) => row.indexname));

    const missingColumns = requiredColumns.filter((name) => !columnSet.has(name));
    const missingConstraints = requiredConstraints.filter((name) => !constraintSet.has(name));
    const missingIndexes = requiredIndexes.filter((name) => !indexSet.has(name));
    const tablePresent = Boolean(table.rows[0]?.name);

    const result = tablePresent && !missingColumns.length && !missingConstraints.length && !missingIndexes.length
      ? 'PASS'
      : 'FAIL';

    console.log(JSON.stringify({
      result,
      databaseModified: false,
      authority: {
        host: new URL(target).hostname,
        port: new URL(target).port || '5432',
        database: new URL(target).pathname.replace(/^\//, ''),
      },
      tablePresent,
      missingColumns,
      missingConstraints,
      missingIndexes,
    }, null, 2));

    process.exitCode = result === 'PASS' ? 0 : 2;
  } finally {
    await client.end();
  }
};

main().catch((error) => {
  console.error(`TAX_ISSUER_PROFILE_SCHEMA_AUDIT_FAILED: ${error.message}`);
  process.exitCode = 1;
});
