'use strict';

// Read-only recovery-clone audit for additive Tax Expense release evidence.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');
const { assertTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority');

const manifestPath = process.argv[2];
if (!manifestPath) {
  throw new Error('Usage: node scripts/verify-tax-expense-recovery-clone.js <recovery-bundle.manifest.json>');
}

const root = process.cwd();
dotenv.config({ path: path.join(root, '.env.restore'), override: true });

const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
const authorityEnv = { ...process.env };
delete authorityEnv.DATABASE_URL;
delete authorityEnv.DIRECT_URL;
delete authorityEnv.PRODUCTION_DATABASE_URL;
const authority = assertTestDatabaseAuthority({ targetUrl, env: authorityEnv });

const manifest = JSON.parse(fs.readFileSync(path.resolve(manifestPath), 'utf8'));
if (manifest.recoveryBundleVersion !== 'ALPHATECH_PG_DUMP_PUBLIC_LEGACY_TAX_V1') {
  throw new Error('Recovery manifest is not an approved bundle.');
}

const url = new URL(targetUrl);
url.searchParams.delete('sslmode');
const quote = (value) => `"${String(value).replace(/"/g, '""')}"`;

const NEW_TABLES = Object.freeze([
  'MissingCostResolution',
  'MissingCostResolutionVersion',
  'MissingCostResolutionEvent',
  'TaxExpenseCategory',
  'TaxExpense',
  'TaxExpenseItem',
  'TaxExpenseAssessment',
  'TaxExpenseLifecycleEvent',
  'TaxExpenseAttachment',
]);

const EXPECTED_MIGRATIONS = Object.freeze([
  '20260801103000_missing_cost_resolution_persistence',
  '20260801183000_tax_expense_foundation',
]);

async function main() {
  const client = new Client({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const rowCountMismatches = [];

    for (const [key, expected] of Object.entries(manifest.tableCounts || {})) {
      // Release migrations append their own ledger rows, so they are verified separately below.
      if (key === 'public._prisma_migrations') continue;
      const [schema, table] = key.split('.', 2);
      const result = await client.query(
        `SELECT COUNT(*)::bigint AS count FROM ${quote(schema)}.${quote(table)}`,
      );
      const actual = Number(result.rows[0].count);
      if (actual !== Number(expected)) rowCountMismatches.push({ table: key, expected: Number(expected), actual });
    }

    const tablePresence = {};
    for (const table of NEW_TABLES) {
      const result = await client.query(
        'SELECT to_regclass($1) IS NOT NULL AS present',
        [`public.${quote(table)}`],
      );
      tablePresence[table] = result.rows[0].present;
    }

    const ledger = await client.query(
      `SELECT migration_name
       FROM "_prisma_migrations"
       WHERE migration_name = ANY($1::text[])
         AND finished_at IS NOT NULL
         AND rolled_back_at IS NULL
       ORDER BY migration_name`,
      [EXPECTED_MIGRATIONS],
    );

    await client.query('COMMIT');

    const appliedMigrations = ledger.rows.map((row) => row.migration_name);
    const missingTables = Object.entries(tablePresence).filter(([, present]) => !present).map(([table]) => table);
    const missingMigrations = EXPECTED_MIGRATIONS.filter((migration) => !appliedMigrations.includes(migration));
    const passed = rowCountMismatches.length === 0 && missingTables.length === 0 && missingMigrations.length === 0;

    console.log(JSON.stringify({
      result: passed ? 'PASS' : 'FAIL',
      databaseModified: false,
      authority: authority.target,
      originalTablesChecked: Object.keys(manifest.tableCounts || {}).filter((key) => key !== 'public._prisma_migrations').length,
      rowCountMismatches,
      newTables: tablePresence,
      appliedMigrations,
      missingMigrations,
    }, null, 2));

    process.exitCode = passed ? 0 : 2;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`TAX_EXPENSE_RECOVERY_CLONE_AUDIT_FAILED: ${error.message || error}`);
  process.exitCode = 1;
});
