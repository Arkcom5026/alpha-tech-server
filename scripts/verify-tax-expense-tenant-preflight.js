'use strict';

// Read-only guard: tenant-isolation migration refuses to backfill existing Tax Expense data.
const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env', override: false });

const targetUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!targetUrl) throw new Error('DATABASE_URL or DIRECT_URL is required.');

async function main() {
  const url = new URL(targetUrl);
  url.searchParams.delete('sslmode');
  const client = new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });

  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const result = await client.query(
      'SELECT (SELECT COUNT(*)::bigint FROM "TaxExpense") AS expenses, (SELECT COUNT(*)::bigint FROM "TaxExpenseItem") AS items',
    );
    await client.query('COMMIT');

    const counts = {
      taxExpenses: Number(result.rows[0].expenses),
      taxExpenseItems: Number(result.rows[0].items),
    };
    const passed = counts.taxExpenses === 0 && counts.taxExpenseItems === 0;
    console.log(JSON.stringify({
      result: passed ? 'PASS' : 'FAIL',
      databaseModified: false,
      authority: { host: url.hostname, port: url.port || '5432', database: url.pathname.slice(1) },
      counts,
      reason: passed ? null : 'Existing Tax Expense data requires an explicit migration plan; automatic backfill is prohibited.',
    }, null, 2));
    process.exitCode = passed ? 0 : 2;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`TAX_EXPENSE_TENANT_PREFLIGHT_FAILED: ${error.message || error}`);
  process.exitCode = 1;
});
