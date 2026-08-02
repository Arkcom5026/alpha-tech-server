'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routes = require('../src/modules/tax-expense/routes/taxExpenseRoutes');

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
assert.match(contextSource, /branchId is required from authenticated token/);

console.log('Tax expense runtime contract: PASS');
