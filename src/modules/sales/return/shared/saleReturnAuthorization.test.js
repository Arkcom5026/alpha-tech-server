const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');

const root = path.resolve(__dirname, '../../../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('legacy employee roles preserve sale return access while positions migrate', () => {
  for (const role of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    assert.equal(hasCapability({ employeeRole: role }, POSITION_CAPABILITIES.SALES_RETURN), true);
  }
  assert.equal(hasCapability({ employeeRole: 'OWNER' }, POSITION_CAPABILITIES.SALES_RETURN_DEDUCTION_APPROVE), true);
  assert.equal(hasCapability({ employeeRole: 'MANAGER' }, POSITION_CAPABILITIES.SALES_RETURN_DEDUCTION_APPROVE), true);
  assert.equal(hasCapability({ employeeRole: 'CASHIER' }, POSITION_CAPABILITIES.SALES_RETURN_DEDUCTION_APPROVE), false);
  assert.equal(hasCapability({ employeeRole: 'TECHNICIAN' }, POSITION_CAPABILITIES.SALES_RETURN_DEDUCTION_APPROVE), false);
});

test('migrated positions require explicit sale return capabilities', () => {
  const empty = { positionCapabilities: [] };
  assert.equal(hasCapability(empty, POSITION_CAPABILITIES.SALES_RETURN), false);
  assert.equal(hasCapability(empty, POSITION_CAPABILITIES.SALES_RETURN_DEDUCTION_APPROVE), false);

  const accessOnly = { positionCapabilities: [POSITION_CAPABILITIES.SALES_RETURN] };
  assert.equal(hasCapability(accessOnly, POSITION_CAPABILITIES.SALES_RETURN), true);
  assert.equal(hasCapability(accessOnly, POSITION_CAPABILITIES.SALES_RETURN_DEDUCTION_APPROVE), false);

  const full = { positionCapabilities: [
    POSITION_CAPABILITIES.SALES_RETURN,
    POSITION_CAPABILITIES.SALES_RETURN_DEDUCTION_APPROVE,
  ] };
  assert.equal(hasCapability(full, POSITION_CAPABILITIES.SALES_RETURN), true);
  assert.equal(hasCapability(full, POSITION_CAPABILITIES.SALES_RETURN_DEDUCTION_APPROVE), true);
});

test('platform admin keeps sale return authority', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    assert.equal(hasCapability({ role }, POSITION_CAPABILITIES.SALES_RETURN), true);
    assert.equal(hasCapability({ role }, POSITION_CAPABILITIES.SALES_RETURN_DEDUCTION_APPROVE), true);
  }
});

test('sale return routes and deduction approval use centralized position authority', () => {
  const routes = read('src/modules/sales/return/routes/saleReturnRoutes.js');
  const policy = read('src/modules/sales/return/policies/saleReturnApprovalPolicy.js');
  const service = read('src/modules/sales/return/services/saleReturnService.js');

  assert.match(routes, /router\.use\(requireSaleReturnAccess\)/);
  assert.match(policy, /SALES_RETURN_DEDUCTION_APPROVE/);
  assert.match(policy, /hasCapability/);
  assert.doesNotMatch(policy, /DEDUCTED_REFUND_ROLES/);
  assert.doesNotMatch(service, /findEmployeeReturnAuthority/);
});
