'use strict';

const path = require('node:path');
const fs = require('node:fs');
const dotenv = require('dotenv');
const { Client } = require('pg');
const { assertTestDatabaseAuthority } = require('../recovery/testDatabaseAuthority');

const expenseId = Number(process.argv[2]);
const expectedBranchId = Number(process.argv[3]);

if (!Number.isInteger(expenseId) || expenseId <= 0 || !Number.isInteger(expectedBranchId) || expectedBranchId <= 0) {
  require('../tests/tax-expense-e2e-outcome.contract.test');
  console.log('Tax Expense E2E outcome: SKIP (expenseId and branchId not supplied; contract verified).');
  return;
}

const restorePath = path.join(process.cwd(), '.env.restore');
if (!fs.existsSync(restorePath)) throw new Error('Missing .env.restore.');

dotenv.config({ path: restorePath, override: true });
const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
const authorityEnv = { ...process.env };
delete authorityEnv.DATABASE_URL;
delete authorityEnv.DIRECT_URL;
delete authorityEnv.PRODUCTION_DATABASE_URL;
const authority = assertTestDatabaseAuthority({ targetUrl, env: authorityEnv });

const asNumber = (value) => Number(value || 0);
const sameMoney = (left, right) => Math.abs(asNumber(left) - asNumber(right)) < 0.0001;

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
    const expenseResult = await client.query(
      `SELECT
         e."id",
         e."branchId",
         e."supplierId",
         e."expenseNumber",
         e."documentNumber",
         e."status",
         e."subtotalAmount",
         e."vatAmount",
         e."totalAmount",
         e."withholdingTaxAmount",
         e."paymentDueAmount",
         e."createdByEmployeeId",
         s."branchId" AS "supplierBranchId",
         COUNT(i."id")::int AS "itemCount",
         COALESCE(SUM(i."subtotalAmount"), 0) AS "itemSubtotalAmount",
         COALESCE(SUM(i."vatAmount"), 0) AS "itemVatAmount",
         COALESCE(SUM(i."withholdingTaxAmount"), 0) AS "itemWithholdingTaxAmount",
         COUNT(*) FILTER (WHERE i."branchId" <> e."branchId")::int AS "crossBranchItemCount",
         COUNT(*) FILTER (WHERE c."branchId" <> e."branchId")::int AS "crossBranchCategoryCount"
       FROM "TaxExpense" e
       LEFT JOIN "Supplier" s ON s."id" = e."supplierId"
       LEFT JOIN "TaxExpenseItem" i ON i."taxExpenseId" = e."id"
       LEFT JOIN "TaxExpenseCategory" c ON c."id" = i."categoryId"
       WHERE e."id" = $1
       GROUP BY e."id", s."branchId"`,
      [expenseId],
    );

    const lifecycleResult = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM "TaxExpenseLifecycleEvent"
       WHERE "taxExpenseId" = $1
         AND "eventType" = 'RECORDED'
         AND "resultingStatus" = 'RECORDED'`,
      [expenseId],
    );
    await client.query('COMMIT');

    const expense = expenseResult.rows[0] || null;
    const failures = [];
    if (!expense) failures.push('TAX_EXPENSE_NOT_FOUND');
    if (expense && expense.branchId !== expectedBranchId) failures.push('BRANCH_ID_MISMATCH');
    if (expense && expense.supplierBranchId !== expectedBranchId) failures.push('SUPPLIER_BRANCH_MISMATCH');
    if (expense && expense.itemCount < 1) failures.push('ITEMS_MISSING');
    if (expense && expense.crossBranchItemCount !== 0) failures.push('CROSS_BRANCH_ITEM');
    if (expense && expense.crossBranchCategoryCount !== 0) failures.push('CROSS_BRANCH_CATEGORY');
    if (expense && !sameMoney(expense.subtotalAmount, expense.itemSubtotalAmount)) failures.push('SUBTOTAL_MISMATCH');
    if (expense && !sameMoney(expense.vatAmount, expense.itemVatAmount)) failures.push('VAT_MISMATCH');
    if (expense && !sameMoney(expense.withholdingTaxAmount, expense.itemWithholdingTaxAmount)) failures.push('WITHHOLDING_MISMATCH');
    if (expense && !sameMoney(expense.totalAmount, asNumber(expense.subtotalAmount) + asNumber(expense.vatAmount))) failures.push('TOTAL_MISMATCH');
    if (expense && !sameMoney(expense.paymentDueAmount, asNumber(expense.totalAmount) - asNumber(expense.withholdingTaxAmount))) failures.push('PAYMENT_DUE_MISMATCH');
    if (Number(lifecycleResult.rows[0]?.count || 0) < 1) failures.push('RECORDED_LIFECYCLE_MISSING');

    console.log(JSON.stringify({
      result: failures.length === 0 ? 'PASS' : 'FAIL',
      databaseModified: false,
      authority: authority.target,
      expenseId,
      expectedBranchId,
      failures,
      expense,
      recordedLifecycleCount: Number(lifecycleResult.rows[0]?.count || 0),
    }, null, 2));

    process.exitCode = failures.length === 0 ? 0 : 2;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`TAX_EXPENSE_E2E_OUTCOME_FAILED: ${error.message || error}`);
  process.exitCode = 1;
});
