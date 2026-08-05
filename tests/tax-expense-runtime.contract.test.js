'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routes = require('../src/modules/tax-expense/routes/taxExpenseRoutes');
const {
  ListTaxExpensesRepository,
} = require('../src/modules/tax-expense/query/list/listTaxExpensesSlice');
const {
  asOptionalDate,
  asRequiredDate,
} = require('../src/modules/tax-expense/shared/taxExpenseContext');

const routeContracts = routes.stack
  .filter((layer) => layer.route)
  .map((layer) => ({ path: layer.route.path, methods: Object.keys(layer.route.methods).sort() }));

assert.deepEqual(routeContracts, [
  { path: '/categories', methods: ['get'] },
  { path: '/categories', methods: ['post'] },
  { path: '/expense-payees', methods: ['get'] },
  { path: '/', methods: ['get'] },
  { path: '/', methods: ['post'] },
]);

const root = path.join(__dirname, '..', 'src', 'modules', 'tax-expense');
const createSource = fs.readFileSync(path.join(root, 'create', 'createTaxExpenseSlice.js'), 'utf8');
const payeeSource = fs.readFileSync(path.join(root, 'query', 'expense-payees', 'listExpensePayeeSuppliersSlice.js'), 'utf8');
const contextSource = fs.readFileSync(path.join(root, 'shared', 'taxExpenseContext.js'), 'utf8');

assert.match(payeeSource, /branchId,/);
assert.match(payeeSource, /capabilities:\s*\{\s*some:\s*\{\s*capability:\s*'EXPENSE_PAYEE'/);
assert.match(createSource, /capabilities:\s*\{\s*some:\s*\{\s*capability:\s*'EXPENSE_PAYEE'/);
assert.match(createSource, /where:\s*\{\s*branchId,\s*active:\s*true,/);
assert.match(createSource, /items:\s*\{\s*create:/);
assert.match(createSource, /lifecycleEvents:\s*\{\s*create:/);
assert.match(createSource, /TAX_EXPENSE_WITHHOLDING_EXCEEDS_TOTAL/);
assert.match(createSource, /asOptionalDate\(input\?\.documentDate/);
assert.match(createSource, /asOptionalDate\(input\?\.receivedAt/);
assert.match(contextSource, /branchId is required from authenticated token/);

assert.ok(asRequiredDate('2026-08-04', 'expenseDate') instanceof Date);
assert.equal(asOptionalDate('', 'documentDate'), null);
assert.throws(
  () => asRequiredDate('not-a-date', 'expenseDate'),
  (error) => error.code === 'TAX_EXPENSE_VALIDATION_ERROR' && error.statusCode === 400,
);
assert.throws(
  () => asOptionalDate('not-a-date', 'receivedAt'),
  (error) => error.code === 'TAX_EXPENSE_VALIDATION_ERROR' && error.statusCode === 400,
);

const calls = [];
const repository = new ListTaxExpensesRepository({
  taxExpense: {
    findMany: (options) => {
      calls.push(options);
      return options;
    },
  },
});

repository.findMany(2, {});
assert.deepEqual(calls.at(-1).where, { branchId: 2 });
assert.equal(Object.hasOwn(calls.at(-1).where, 'expenseDate'), false);

repository.findMany(2, { fromDate: '2026-08-01' });
assert.ok(calls.at(-1).where.expenseDate.gte instanceof Date);
assert.equal(Object.hasOwn(calls.at(-1).where.expenseDate, 'lte'), false);

repository.findMany(2, { toDate: '2026-08-03' });
assert.ok(calls.at(-1).where.expenseDate.lte instanceof Date);
assert.equal(Object.hasOwn(calls.at(-1).where.expenseDate, 'gte'), false);

repository.findMany(2, { fromDate: 'invalid', toDate: '' });
assert.equal(Object.hasOwn(calls.at(-1).where, 'expenseDate'), false);

console.log('Tax expense runtime contract: PASS');
