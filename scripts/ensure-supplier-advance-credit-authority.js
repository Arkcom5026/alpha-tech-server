require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const lockKey = 26072805;
const migrationPath = path.resolve(
  __dirname,
  '../prisma/migrations/20260728203000_supplier_advance_credit_authority/migration.sql',
);

const inspect = async (client) => {
  const result = await client.query(`
    SELECT
      to_regtype('public."SupplierAdvanceStatus"') IS NOT NULL AS advance_status,
      to_regclass('public."SupplierAdvance"') IS NOT NULL AS advance_table,
      to_regclass('public."SupplierAdvanceAllocation"') IS NOT NULL AS allocation_table,
      to_regclass('public."SupplierAdvance_paymentId_key"') IS NOT NULL AS payment_key,
      to_regclass('public."SupplierAdvance_branchId_supplierId_status_idx"') IS NOT NULL AS supplier_status_index
  `);
  return result.rows[0];
};

const ready = (state) => Object.values(state).every(Boolean);
const partial = (state) => Object.values(state).some(Boolean);

async function main() {
  const raw = process.env.DATABASE_URL || process.env.DIRECT_URL;
  const authority = process.env.DATABASE_URL ? 'DATABASE_URL' : 'DIRECT_URL';
  if (!raw) throw new Error('DATABASE_URL or DIRECT_URL is required');
  console.log(`[db] Supplier advance connection authority: ${authority}`);

  const url = new URL(raw);
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  const client = new Client({
    connectionString: url.toString(),
    ssl: local ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [lockKey]);
    const before = await inspect(client);
    if (ready(before)) {
      console.log('[db] Supplier advance credit authority is ready');
      return;
    }
    if (partial(before)) throw new Error('Supplier advance credit authority is partially applied');
    await client.query('BEGIN');
    try {
      await client.query(fs.readFileSync(migrationPath, 'utf8'));
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    if (!ready(await inspect(client))) throw new Error('Supplier advance credit authority verification failed');
    console.log('[db] Supplier advance credit authority is ready');
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [lockKey]);
    } finally {
      await client.end();
    }
  }
}

main().catch((error) => {
  console.error('[db] Supplier advance credit authority failed:', error.message);
  process.exitCode = 1;
});
