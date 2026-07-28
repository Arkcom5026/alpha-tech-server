require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const lockKey = 26072804;
const migrationPath = path.resolve(
  __dirname,
  '../prisma/migrations/20260728193000_supplier_payment_allocation_authority/migration.sql',
);

const inspect = async (client) => {
  const result = await client.query(`
    SELECT
      to_regtype('public."SupplierPaymentLifecycleStatus"') IS NOT NULL AS lifecycle_status,
      to_regtype('public."SupplierPaymentAllocationState"') IS NOT NULL AS allocation_state,
      to_regclass('public."SupplierPaymentAllocation"') IS NOT NULL AS allocation_table,
      to_regclass('public."SupplierPaymentAllocation_active_payment_payable_key"') IS NOT NULL AS active_key,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'SupplierPayment'
          AND column_name = 'lifecycleStatus'
      ) AS payment_lifecycle
  `);
  return result.rows[0];
};

const ready = (state) => Object.values(state).every(Boolean);
const partial = (state) => Object.values(state).some(Boolean);

async function main() {
  const raw = process.env.DATABASE_URL || process.env.DIRECT_URL;
  const authority = process.env.DATABASE_URL ? 'DATABASE_URL' : 'DIRECT_URL';
  if (!raw) throw new Error('DATABASE_URL or DIRECT_URL is required');
  console.log(`[db] Supplier payment allocation connection authority: ${authority}`);

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
      console.log('[db] Supplier payment allocation authority is ready');
      return;
    }
    if (partial(before)) throw new Error('Supplier payment allocation authority is partially applied');
    await client.query('BEGIN');
    try {
      await client.query(fs.readFileSync(migrationPath, 'utf8'));
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    if (!ready(await inspect(client))) {
      throw new Error('Supplier payment allocation authority verification failed');
    }
    console.log('[db] Supplier payment allocation authority is ready');
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [lockKey]);
    } finally {
      await client.end();
    }
  }
}

main().catch((error) => {
  console.error('[db] Supplier payment allocation authority failed:', error.message);
  process.exitCode = 1;
});
