'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const read = (file) => fs.readFileSync(file, 'utf8');

test('repair subcontract requires ExpensePayee and only snapshots its identity', () => {
  const service = read('src/modules/repair/subcontract/repairSubcontractService.js');
  const repository = read('src/modules/repair/subcontract/repairSubcontractRepository.js');
  assert.match(service, /positiveInteger\(input\.expensePayeeId/);
  assert.match(service, /findExpensePayee/);
  assert.match(repository, /"expensePayeeId"/);
  assert.doesNotMatch(service, /taxExpense\.create/);
});

test('accounting validates the repair reason against job branch payee and subcontract', () => {
  const source = read('src/modules/tax-expense/create/createTaxExpenseSlice.js');
  assert.match(source, /repairJobId/);
  assert.match(source, /repairSubcontractId/);
  assert.match(source, /expensePayeeId/);
  assert.match(source, /TAX_EXPENSE_REPAIR_REASON_MISMATCH/);
  assert.doesNotMatch(source, /repairJob\.update/);
  assert.doesNotMatch(source, /repairSubcontract\.update/);
});

test('return stores operational costs without creating accounting authority', () => {
  const service = read('src/modules/repair/subcontract/repairSubcontractService.js');
  assert.match(service, /transportCost/);
  assert.match(service, /materialCost/);
  assert.match(service, /otherOperationalCost/);
  assert.doesNotMatch(service, /TaxExpense/);
});
