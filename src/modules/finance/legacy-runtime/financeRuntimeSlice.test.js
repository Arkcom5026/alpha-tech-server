const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('finance runtime route no longer imports the root legacy controller', () => {
  const route = read('src/modules/finance/legacy-runtime/routes/financeRuntimeRoutes.js');
  assert.doesNotMatch(route, /controllers\/financeController/);
  assert.match(route, /require\('\.\.\/financeRuntimeController'\)/);
});

test('finance runtime slice keeps branch authority ahead of service access', () => {
  const controller = read('src/modules/finance/legacy-runtime/financeRuntimeController.js');
  assert.match(controller, /req\?\.user\?\.branchId/);
  assert.match(controller, /status\(401\)\.json\(\{ message: 'unauthorized' \}\)/);
});

test('finance repository scopes receivable and customer credit reads by branch', () => {
  const repository = read('src/modules/finance/legacy-runtime/financeRuntimeRepository.js');
  assert.match(repository, /branchId, statusPayment/);
  assert.match(repository, /branchId:\s*input\.branchId/);
  assert.match(repository, /customerId:\s*input\.customerId/);
});
