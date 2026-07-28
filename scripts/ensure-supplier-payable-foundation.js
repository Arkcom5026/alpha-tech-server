require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const lockKey = 26072803;
const migrationPath = path.resolve(
  __dirname,
  '../prisma/migrations/20260728183000_supplier_payable_foundation/migration.sql',
);

const inspectFoundation = async (client) => {
  const result = await client.query(`
    SELECT
      to_regtype('public."SupplierPayableStatus"') IS NOT NULL AS payable_status,
      to_regclass('public."SupplierPayable"') IS NOT NULL AS payable_table,
      to_regclass('public."SupplierPayableReceiptLink"') IS NOT NULL AS receipt_link_table,
      to_regclass('public."SupplierPayable_code_key"') IS NOT NULL AS code_key,
      to_regclass('public."SupplierPayable_branchId_supplierId_status_idx"') IS NOT NULL AS supplier_status_index,
      to_regclass('public."SupplierPayableReceiptLink_receiptId_idx"') IS NOT NULL AS receipt_index
  `);
  return result.rows[0];
};

const isReady = (state) => Object.values(state).every(Boolean);
const hasPartialAuthority = (state) => Object.values(state).some(Boolean);

async function main() {
  const rawConnectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  const connectionAuthority = process.env.DATABASE_URL ? 'DATABASE_URL' : 'DIRECT_URL';
  if (!rawConnectionString) throw new Error('DATABASE_URL or DIRECT_URL is required');

  console.log(`[db] Supplier payable connection authority: ${connectionAuthority}`);
  const databaseUrl = new URL(rawConnectionString);
  const isLocalDatabase = ['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname);
  for (const parameter of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) {
    databaseUrl.searchParams.delete(parameter);
  }
  const client = new Client({
    connectionString: databaseUrl.toString(),
    ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [lockKey]);
    const before = await inspectFoundation(client);
    if (isReady(before)) {
      console.log('[db] Supplier payable foundation is ready');
      return;
    }
    if (hasPartialAuthority(before)) {
      throw new Error('Supplier payable foundation is partially applied');
    }
    await client.query('BEGIN');
    try {
      await client.query(fs.readFileSync(migrationPath, 'utf8'));
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    if (!isReady(await inspectFoundation(client))) {
      throw new Error('Supplier payable foundation verification failed');
    }
    console.log('[db] Supplier payable foundation is ready');
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [lockKey]);
    } finally {
      await client.end();
    }
  }
}

main().catch((error) => {
  console.error('[db] Supplier payable foundation failed:', error.message);
  process.exitCode = 1;
});
