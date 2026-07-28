require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const lockKey = 26072807;
const migrationPath = path.resolve(__dirname, '../prisma/migrations/20260728223000_pos_held_cart_foundation/migration.sql');
const inspect = async (client) => (await client.query(`
  SELECT
    to_regtype('public."PosHeldCartStatus"') IS NOT NULL AS status_type,
    to_regtype('public."PosHeldCartLineType"') IS NOT NULL AS line_type,
    to_regclass('public."PosHeldCart"') IS NOT NULL AS held_cart,
    to_regclass('public."PosHeldCartLine"') IS NOT NULL AS held_cart_line,
    to_regclass('public."Sale_sourceHeldCartId_key"') IS NOT NULL AS sale_link_key
`)).rows[0];
const ready = (state) => Object.values(state).every(Boolean);
const partial = (state) => Object.values(state).some(Boolean);

async function main() {
  const raw = process.env.DATABASE_URL || process.env.DIRECT_URL;
  const authority = process.env.DATABASE_URL ? 'DATABASE_URL' : 'DIRECT_URL';
  if (!raw) throw new Error('DATABASE_URL or DIRECT_URL is required');
  console.log(`[db] POS held cart connection authority: ${authority}`);
  const url = new URL(raw);
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  const client = new Client({ connectionString: url.toString(), ssl: local ? false : { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [lockKey]);
    const before = await inspect(client);
    if (ready(before)) {
      console.log('[db] POS held cart foundation is ready');
      return;
    }
    if (partial(before)) throw new Error('POS held cart foundation is partially applied');
    await client.query('BEGIN');
    try {
      await client.query(fs.readFileSync(migrationPath, 'utf8'));
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    if (!ready(await inspect(client))) throw new Error('POS held cart foundation verification failed');
    console.log('[db] POS held cart foundation is ready');
  } finally {
    try { await client.query('SELECT pg_advisory_unlock($1)', [lockKey]); } finally { await client.end(); }
  }
}
main().catch((error) => {
  console.error('[db] POS held cart foundation failed:', error.message);
  process.exitCode = 1;
});
