'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routes = require('../src/modules/tax-expense/routes/taxExpenseRoutes');
const { ListTaxExpensesRepository } = require('../src/modules/tax-expense/query/list/listTaxExpensesSlice');
const { ListExpensePayeesRepository } = require('../src/modules/tax-expense/expense-payee/query/list/listExpensePayeesSlice');
const { CreateExpensePayeeRepository, asPayeeType } = require('../src/modules/tax-expense/expense-payee/create/createExpensePayeeSlice');
const { asOptionalDate, asRequiredDate } = require('../src/modules/tax-expense/shared/taxExpenseContext');

const routeContracts = routes.stack
  .filter((layer) => layer.route)
  .map((layer) => ({ path: layer.route.path, methods: Object.keys(layer.route.methods).sort() }));

assert.deepEqual(routeContracts, [
  { path: '/categories', methods: ['get'] },
  { path: '/categories', methods: ['post'] },
  { path: '/expense-payees', methods: ['get'] },
  { path: '/expense-payees', methods: ['post'] },
  { path: '/repair-reasons', methods: ['get'] },
  { path: '/:taxExpenseId/assessment-suggestion', methods: ['get'] },
  { path: '/:taxExpenseId/assessment-confirmation', methods: ['post'] },
  { path: '/:taxExpenseId/evidence/verify', methods: ['post'] },
  { path: '/', methods: ['get'] },
  { path: '/', methods: ['post'] },
]);

const root = path.join(__dirname, '..', 'src', 'modules', 'tax-expense');
const createSource = fs.readFileSync(path.join(root, 'create', 'createTaxExpenseSlice.js'), 'utf8');
const payeeListSource = fs.readFileSync(path.join(root, 'expense-payee', 'query', 'list', 'listExpensePayeesSlice.js'), 'utf8');
const payeeCreateSource = fs.readFileSync(path.join(root, 'expense-payee', 'create', 'createExpensePayeeSlice.js'), 'utf8');
const routeSource = fs.readFileSync(path.join(root, 'routes', 'taxExpenseRoutes.js'), 'utf8');
const contextSource = fs.readFileSync(path.join(root, 'shared', 'taxExpenseContext.js'), 'utf8');

assert.match(payeeListSource, /this\.prisma\.expensePayee\.findMany/);
assert.match(payeeListSource, /branchId,\s*active:\s*true/);
assert.doesNotMatch(payeeListSource, /this\.prisma\.supplier/);
assert.match(payeeCreateSource, /this\.prisma\.expensePayee\.create/);
assert.doesNotMatch(routeSource, /listExpensePayeeSuppliersSlice/);
assert.match(createSource, /input\?\.expensePayeeId/);
assert.match(createSource, /tx\.expensePayee\.findFirst/);
assert.match(createSource, /where:\s*\{\s*id:\s*expensePayeeId,\s*branchId,\s*active:\s*true\s*\}/);
assert.match(createSource, /expensePayeeId:\s*expensePayee\.id/);
assert.match(createSource, /supplierId:\s*null/);
assert.match(createSource, /counterpartyType:\s*'EXPENSE_PAYEE'/);
assert.match(createSource, /include:\s*\{[\s\S]*expensePayee:/);
assert.doesNotMatch(createSource, /tx\.supplier/);
assert.doesNotMatch(createSource, /input\?\.supplierId/);
assert.match(createSource, /items:\s*\{\s*create:/);
assert.match(createSource, /lifecycleEvents:\s*\{\s*create:/);
assert.match(createSource, /TAX_EXPENSE_WITHHOLDING_EXCEEDS_TOTAL/);
assert.match(contextSource, /branchId is required from authenticated token/);

assert.equal(asPayeeType(undefined), 'LEGAL_ENTITY');
assert.equal(asPayeeType('individual'), 'INDIVIDUAL');
assert.throws(() => asPayeeType('supplier'), (error) => error.code === 'TAX_EXPENSE_PAYEE_TYPE_INVALID');
assert.ok(asRequiredDate('2026-08-04', 'expenseDate') instanceof Date);
assert.equal(asOptionalDate('', 'documentDate'), null);

const expenseCalls = [];
const expenseRepository = new ListTaxExpensesRepository({
  taxExpense: { findMany: (options) => { expenseCalls.push(options); return options; } },
});
expenseRepository.findMany(2, {});
assert.deepEqual(expenseCalls.at(-1).where, { branchId: 2 });

const payeeListCalls = [];
const payeeListRepository = new ListExpensePayeesRepository({
  expensePayee: { findMany: (options) => { payeeListCalls.push(options); return options; } },
});
payeeListRepository.findMany(2, 'office');
assert.equal(payeeListCalls.at(-1).where.branchId, 2);
assert.equal(payeeListCalls.at(-1).where.active, true);

const payeeCreateCalls = [];
const payeeCreateRepository = new CreateExpensePayeeRepository({
  expensePayee: { create: (options) => { payeeCreateCalls.push(options); return options; } },
});
payeeCreateRepository.create({
  branchId: 2,
  employeeId: 35,
  input: { payeeType: 'LEGAL_ENTITY', name: 'Office Services Co., Ltd.', taxId: null, taxBranchCode: '00000', address: null, phone: null, email: null, contactPerson: null, notes: null },
});
assert.equal(payeeCreateCalls.at(-1).data.branchId, 2);
assert.equal(payeeCreateCalls.at(-1).data.createdByEmployeeId, 35);

console.log('Tax expense runtime contract: PASS');
