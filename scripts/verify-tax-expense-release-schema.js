'use strict';

// Read-only verification for the deployed Tax Expense and Supplier Capability schema.
const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env', override: false });

const targetUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!targetUrl) throw new Error('DATABASE_URL or DIRECT_URL is required.');

const REQUIRED_MIGRATIONS = Object.freeze([
  '20260801103000_missing_cost_resolution_persistence',
  '20260801183000_tax_expense_foundation',
  '20260802103000_supplier_capability_foundation',
]);

const REQUIRED_TABLES = Object.freeze([
  'MissingCostResolution',
  'MissingCostResolutionVersion',
  'MissingCostResolutionEvent',
  'TaxExpenseCategory',
  'TaxExpense',
  'TaxExpenseItem',
  'TaxExpenseAssessment',
  'TaxExpenseLifecycleEvent',
  'TaxExpenseAttachment',
  'SupplierCapabilityAssignment',
]);

const quote = (value) => `"${String(value).replace(/"/g, '""')}"`;

async function main() {
  const url = new URL(targetUrl);
  url.searchParams.delete('sslmode');

  const client = new Client({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');

    const tables = {};
    for (const table of REQUIRED_TABLES) {
      const result = await client.query(
        'SELECT to_regclass($1) IS NOT NULL AS present',
        [`public.${quote(table)}`],
      );
      tables[table] = result.rows[0].present;
    }

    const ledger = await client.query(
      `SELECT migration_name
       FROM "_prisma_migrations"
       WHERE migration_name = ANY($1::text[])
         AND finished_at IS NOT NULL
         AND rolled_back_at IS NULL
       ORDER BY migration_name`,
      [REQUIRED_MIGRATIONS],
    );

    const missingTables = Object.entries(tables)
      .filter(([, present]) => !present)
      .map(([table]) => table);
    const appliedMigrations = ledger.rows.map((row) => row.migration_name);
    const missingMigrations = REQUIRED_MIGRATIONS
      .filter((migration) => !appliedMigrations.includes(migration));

    await client.query('COMMIT');

    console.log(JSON.stringify({
      result: missingTables.length === 0 && missingMigrations.length === 0 ? 'PASS' : 'FAIL',
      databaseModified: false,
      authority: {
        host: url.hostname,
        port: url.port || '5432',
        database: url.pathname.slice(1),

    process.exitCode = missingTables.length || missingMigrations.length ? 2 : 0;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`TAX_EXPENSE_RELEASE_SCHEMA_AUDIT_FAILED: ${error.message || error}`);
  process.exitCode = 1;
});
