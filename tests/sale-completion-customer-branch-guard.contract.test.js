const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  SaleCustomerAccessService,
} = require('../src/modules/sales/completion/services/saleCustomerAccessService');

const root = path.join(__dirname, '..');
const controllerSource = fs.readFileSync(
  path.join(root, 'src/modules/sales/completion/controllers/saleCompletionController.js'),
  'utf8'
);
const repositorySource = fs.readFileSync(
  path.join(root, 'src/modules/sales/completion/repositories/saleCustomerAccessRepository.js'),
  'utf8'
);
const policySource = fs.readFileSync(
  path.join(root, 'src/modules/customer/policies/customerBranchAccessPolicy.js'),
  'utf8'
);

test('completion controller checks authenticated-store customer access before sale mutation', () => {
  assert.match(controllerSource, /saleCustomerAccessService\.assertAccessible/);
  assert.ok(
    controllerSource.indexOf('saleCustomerAccessService.assertAccessible') <
      controllerSource.indexOf('completeSale({ command, branchId, employeeId })'),
    'customer branch guard must run before Sale Completion mutation'
  );
  assert.doesNotMatch(controllerSource, /req\.body\.branchId/);
});

test('completion customer repository uses the shared branch-access authority', () => {
  assert.match(repositorySource, /buildCustomerBranchAccessWhere/);
  assert.match(repositorySource, /customerProfile\.findFirst/);
  assert.match(policySource, /sales:\s*\{\s*some:\s*\{\s*branchId/);
  assert.match(policySource, /repairJobs:\s*\{\s*some:\s*\{\s*branchId/);
  assert.match(policySource, /deviceIntakes:\s*\{\s*some:\s*\{\s*branchId/);
  assert.match(policySource, /ownedDevices:\s*\{\s*some:/);
});

test('customer from the authenticated store is accepted', async () => {
  const calls = [];
  const service = new SaleCustomerAccessService({
    async findAccessibleCustomer(input) {
      calls.push(input);
      return { id: 42, type: 'INDIVIDUAL', paymentTerms: 0 };
    },
  });

  const customer = await service.assertAccessible({ customerId: 42, branchId: 2 });
  assert.equal(customer.id, 42);
  assert.deepEqual(calls, [{ customerId: 42, branchId: 2 }]);
});

test('forged or cross-store customer id is rejected without disclosing global existence', async () => {
  const service = new SaleCustomerAccessService({
    async findAccessibleCustomer() {
      return null;
    },
  });

  await assert.rejects(
    () => service.assertAccessible({ customerId: 999, branchId: 2 }),
    {
      status: 404,
      code: 'SALE_CUSTOMER_NOT_ACCESSIBLE_IN_BRANCH',
      message: 'Customer was not found in the authenticated store',
    }
  );
});

test('anonymous cash sale without customer remains supported', async () => {
  let called = false;
  const service = new SaleCustomerAccessService({
    async findAccessibleCustomer() {
      called = true;
      return null;
    },
  });

  assert.equal(await service.assertAccessible({ customerId: null, branchId: 2 }), null);
  assert.equal(called, false);
});
