'use strict';

// Read-only post-migration proof for Tax Expense tenant-local foreign keys.
const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env', override: false });

const targetUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!targetUrl) throw new Error('DATABASE_URL or DIRECT_URL is required.');

const REQUIRED_CONSTRAINTS = Object.freeze([
  'TaxExpense_supplierId_branchId_fkey',
  'TaxExpenseItem_taxExpenseId_branchId_fkey',
  'TaxExpenseItem_categoryId_branchId_fkey',
]);

async function main() {
  const url = new URL(targetUrl);
  url.searchParams.delete('sslmode');
  const client = new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });

  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');

    const constraints = await client.query(
      'SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname = ANY($1::text[])',
      [REQUIRED_CONSTRAINTS],
    );
    const branchColumn = await client.query(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'TaxExpenseItem'
           AND column_name = 'branchId'
           AND is_nullable = 'NO'
       ) AS present`,
    );

    await client.query('COMMIT');

    const definitions = Object.fromEntries(constraints.rows.map((row) => [row.conname, row.definition]));
    const missingConstraints = REQUIRED_CONSTRAINTS.filter((name) => !definitions[name]);
    const checks = {
      supplierSameBranch: /FOREIGN KEY \("supplierId", "branchId"\) REFERENCES "Supplier"\("id", "branchId"\)/.test(definitions.TaxExpense_supplierId_branchId_fkey || ''),
      itemParentSameBranch: /FOREIGN KEY \("taxExpenseId", "branchId"\) REFERENCES "TaxExpense"\("id", "branchId"\)/.test(definitions.TaxExpenseItem_taxExpenseId_branchId_fkey || ''),
      itemCategorySameBranch: /FOREIGN KEY \("categoryId", "branchId"\) REFERENCES "TaxExpenseCategory"\("id", "branchId"\)/.test(definitions.TaxExpenseItem_categoryId_branchId_fkey || ''),
      itemBranchIdRequired: branchColumn.rows[0].present,
    };
    const failedChecks = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);

    console.log(JSON.stringify({
      result: missingConstraints.length === 0 && failedChecks.length === 0 ? 'PASS' : 'FAIL',
      databaseModified: false,
      authority: { host: url.hostname, port: url.port || '5432', database: url.pathname.slice(1) },
      checks,
      missingConstraints,
      failedChecks,
    }, null, 2));

    process.exitCode = missingConstraints.length || failedChecks.length ? 2 : 0;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`TAX_EXPENSE_TENANT_SCHEMA_AUDIT_FAILED: ${error.message || error}`);
  process.exitCode = 1;
});
