'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const sql = fs.readFileSync(path.join(__dirname, 'migration.sql'), 'utf8');

test('requires ExpensePayee authority for every repair subcontract', () => {
  assert.match(sql, /ADD COLUMN "expensePayeeId" INTEGER/);
  assert.match(sql, /legacy rows require ExpensePayee mapping/);
  assert.match(sql, /ALTER COLUMN "expensePayeeId" SET NOT NULL/);
  assert.match(sql, /RepairSubcontract_expensePayeeId_branchId_fkey/);
});

test('adds optional paired accounting reason references without creating entries', () => {
  assert.match(sql, /ADD COLUMN "repairJobId" INTEGER/);
  assert.match(sql, /ADD COLUMN "repairSubcontractId" INTEGER/);
  assert.match(sql, /TaxExpense_repair_reason_pair_check/);
  assert.doesNotMatch(sql, /INSERT INTO "TaxExpense"/);
  assert.doesNotMatch(sql, /UPDATE "RepairJob"/);
});
