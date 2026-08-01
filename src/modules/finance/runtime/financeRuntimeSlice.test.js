const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('finance runtime route owns the module-local runtime controller', () => {
  const route = read('src/modules/finance/routes/financeRuntimeRoutes.js');
  assert.doesNotMatch(route, /controllers\/financeController/);
  assert.doesNotMatch(route, /legacy-runtime/);
  assert.match(route, /require\('\.\.\/runtime\/financeRuntimeController'\)/);
});

test('finance runtime slice keeps branch authority ahead of service access', () => {
  const controller = read('src/modules/finance/runtime/financeRuntimeController.js');
  assert.match(controller, /req\?\.user\?\.branchId/);
  assert.match(controller, /status\(401\)\.json\(\{ message: 'unauthorized' \}\)/);
});

test('finance repository scopes receivable and customer credit reads by branch', () => {
  const repository = read('src/modules/finance/runtime/financeRuntimeRepository.js');
  assert.match(repository, /branchId, statusPayment/);
  assert.match(repository, /branchId:\s*input\.branchId/);
  assert.match(repository, /customerId:\s*input\.customerId/);
});
