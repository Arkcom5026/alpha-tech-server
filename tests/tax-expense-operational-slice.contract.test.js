'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { resolveTaxExpenseAuthority } = require('../src/modules/tax/expenses/shared/taxExpenseAuthority');
const {
  normalizeCreateExpenseInput,
  normalizeCategoryInput,
  normalizeListFilters,
} = require('../src/modules/tax/expenses/shared/taxExpenseContract');

const actor = { profileType: 'employee', employeeId: 19, branchId: 7 };
assert.deepEqual(resolveTaxExpenseAuthority({ user: actor, requestedBranchId: 7 }), { branchId: 7, employeeId: 19 });
assert.throws(
  () => resolveTaxExpenseAuthority({ user: actor, requestedBranchId: 8 }),
  { code: 'TAX_EXPENSE_BRANCH_FORBIDDEN' },
);
assert.throws(
  () => resolveTaxExpenseAuthority({ user: { profileType: 'customer', branchId: 7 }, requestedBranchId: 7 }),
  { code: 'TAX_EXPENSE_EMPLOYEE_REQUIRED' },
);

assert.deepEqual(normalizeCategoryInput({ code: ' utilities ', name: ' ค่าไฟ ' }), {
  code: 'UTILITIES',
  name: 'ค่าไฟ',
});

const expense = normalizeCreateExpenseInput({
  counterpartyType: 'OTHER',
  counterpartyName: 'ผู้ให้บริการ',
  expenseDate: '2026-08-01',
  items: [{
    categoryId: 4,
    description: 'ค่าบริการ',
    quantity: 2,
    unitAmount: 50,
    subtotalAmount: 100,
    vatAmount: 7,
  }],
});
assert.equal(expense.subtotalAmount, 100);
assert.equal(expense.vatAmount, 7);
assert.equal(expense.totalAmount, 107);
assert.equal(expense.paymentDueAmount, 107);
assert.equal(expense.items[0].lineNumber, 1);
assert.throws(
  () => normalizeCreateExpenseInput({
    counterpartyName: 'x',
    expenseDate: '2026-08-01',
    items: [{ categoryId: 4, description: 'x', quantity: 2, unitAmount: 50, subtotalAmount: 99 }],
  }),
  { code: 'TAX_EXPENSE_LINE_TOTAL_MISMATCH' },
);
assert.deepEqual(normalizeListFilters({ status: 'draft', supplierId: '5' }), {
  status: 'DRAFT',
  supplierId: 5,
  documentNumber: null,
  fromDate: null,
  toDate: null,
});

const server = fs.readFileSync(path.resolve(__dirname, '../server.js'), 'utf8');
assert.match(server, /taxExpenseRoutes/);
assert.match(server, /app\.use\('\/api\/tax', taxExpenseRoutes\)/);
for (const file of [
  '../src/modules/tax/expenses/categories/taxExpenseCategoryRoutes.js',
  '../src/modules/tax/expenses/categories/taxExpenseCategoryController.js',
  '../src/modules/tax/expenses/categories/taxExpenseCategoryService.js',
  '../src/modules/tax/expenses/categories/taxExpenseCategoryRepository.js',
  '../src/modules/tax/expenses/expenses/taxExpenseRoutes.js',
  '../src/modules/tax/expenses/expenses/taxExpenseController.js',
  '../src/modules/tax/expenses/expenses/taxExpenseService.js',
  '../src/modules/tax/expenses/expenses/taxExpenseRepository.js',
]) assert.ok(fs.existsSync(path.resolve(__dirname, file)), `Missing slice file: ${file}`);

console.log('Tax Expense operational slice contract: PASS');
