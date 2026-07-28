require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const lockKey = 26072802;
const migrationPath = path.resolve(
  __dirname,
  '../prisma/migrations/20260728170000_flexible_input_tax_receipt_links/migration.sql',
);

const inspectFoundation = async (client) => {
  const result = await client.query(`
    SELECT
      to_regtype('public."InputTaxReceiptSourceType"') IS NOT NULL AS source_type,
      to_regtype('public."InputTaxReceiptLinkState"') IS NOT NULL AS link_state,
      to_regtype('public."InputTaxReceiptLinkEventType"') IS NOT NULL AS event_type,
      to_regclass('public."InputTaxDocumentReceiptLink"') IS NOT NULL AS link_table,
      to_regclass('public."InputTaxDocumentReceiptLinkEvent"') IS NOT NULL AS event_table,
      to_regclass('public."InputTaxDocumentReceiptLink_active_source_idx"') IS NOT NULL AS source_index,
      to_regclass('public."InputTaxDocumentReceiptLinkEvent_link_occurred_idx"') IS NOT NULL AS event_index,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'PurchaseOrderReceipt'
          AND column_name = 'deliveryNoteNumber'
      ) AS delivery_note_number,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'PurchaseOrderReceipt'
          AND column_name = 'deliveryNoteDate'
      ) AS delivery_note_date
  `);
  return result.rows[0];
};

const isReady = (state) => Object.values(state).every(Boolean);

const hasPartialAuthority = (state) => (
  state.source_type
  || state.link_state
  || state.event_type
  || state.link_table
  || state.event_table
);

const migrationSql = () => fs.readFileSync(migrationPath, 'utf8')
  .replace(
    'ADD COLUMN "deliveryNoteNumber" TEXT',
    'ADD COLUMN IF NOT EXISTS "deliveryNoteNumber" TEXT',
  )
  .replace(
    'ADD COLUMN "deliveryNoteDate" TIMESTAMP(3)',
    'ADD COLUMN IF NOT EXISTS "deliveryNoteDate" TIMESTAMP(3)',
  );

async function main() {
  const rawConnectionString =
    process.env.DATABASE_URL || process.env.DIRECT_URL;
  const connectionAuthority = process.env.DATABASE_URL
    ? 'DATABASE_URL'
    : 'DIRECT_URL';

  if (!rawConnectionString) {
    throw new Error('DATABASE_URL or DIRECT_URL is required');
  }

  console.log(`[db] Input-tax receipt link connection authority: ${connectionAuthority}`);

  const databaseUrl = new URL(rawConnectionString);
  const isLocalDatabase = ['localhost', '127.0.0.1', '::1'].includes(
    databaseUrl.hostname,
  );
  databaseUrl.searchParams.delete('sslmode');
  databaseUrl.searchParams.delete('sslcert');
  databaseUrl.searchParams.delete('sslkey');
  databaseUrl.searchParams.delete('sslrootcert');

  const client = new Client({
    connectionString: databaseUrl.toString(),
    ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [lockKey]);
    const before = await inspectFoundation(client);
    if (isReady(before)) {
      console.log('[db] Flexible input-tax receipt links are ready');
      return;
    }
    if (hasPartialAuthority(before)) {
      throw new Error('Flexible input-tax receipt link foundation is partially applied');
    }

    await client.query('BEGIN');
    try {
      await client.query(migrationSql());
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    const after = await inspectFoundation(client);
    if (!isReady(after)) {
      throw new Error('Flexible input-tax receipt link verification failed');
    }
    console.log('[db] Flexible input-tax receipt links are ready');
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [lockKey]);
    } finally {
      await client.end();
    }
  }
}

main().catch((error) => {
  console.error('[db] Flexible input-tax receipt link foundation failed:', error.message);
  process.exitCode = 1;
});
