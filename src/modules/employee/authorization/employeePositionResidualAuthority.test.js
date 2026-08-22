const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RESIDUAL_POSITION_CAPABILITIES,
  hasResidualCapability,
} = require('./employeePositionResidualAuthority');

const C = RESIDUAL_POSITION_CAPABILITIES;

test('legacy employee compatibility preserves historical residual authority', () => {
  for (const employeeRole of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    assert.equal(hasResidualCapability({ role: 'EMPLOYEE', employeeRole }, C.COMMUNICATION_ACCESS), true);
    assert.equal(hasResidualCapability({ role: 'EMPLOYEE', employeeRole }, C.STORE_EXPERIENCE_READ), true);
    assert.equal(hasResidualCapability({ role: 'EMPLOYEE', employeeRole }, C.STORE_EXPERIENCE_MANAGE), true);
    assert.equal(hasResidualCapability({ role: 'EMPLOYEE', employeeRole }, C.STORE_EXPERIENCE_PUBLISH), true);
    assert.equal(hasResidualCapability({ role: 'EMPLOYEE', employeeRole }, C.PRODUCT_TRACE_READ), true);
  }

  assert.equal(hasResidualCapability({ role: 'EMPLOYEE', employeeRole: 'OWNER' }, C.COMMUNICATION_PROFILE_MANAGE), true);
  assert.equal(hasResidualCapability({ role: 'EMPLOYEE', employeeRole: 'MANAGER' }, C.PRODUCT_TRACE_FINANCIALS), true);
  assert.equal(hasResidualCapability({ role: 'EMPLOYEE', employeeRole: 'CASHIER' }, C.COMMUNICATION_PROFILE_MANAGE), false);
  assert.equal(hasResidualCapability({ role: 'EMPLOYEE', employeeRole: 'TECHNICIAN' }, C.PRODUCT_TRACE_FINANCIALS), false);
});

test('migrated position capability arrays are authoritative including empty arrays', () => {
  assert.equal(hasResidualCapability({
    role: 'EMPLOYEE',
    employeeRole: 'OWNER',
    positionCapabilities: [],
  }, C.STORE_EXPERIENCE_PUBLISH), false);

  assert.equal(hasResidualCapability({
    role: 'EMPLOYEE',
    employeeRole: 'TECHNICIAN',
    positionCapabilities: [C.PRODUCT_TRACE_FINANCIALS],
  }, C.PRODUCT_TRACE_FINANCIALS), true);
});

test('platform admins retain all residual position capabilities', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    for (const capability of Object.values(C)) {
      assert.equal(hasResidualCapability({ role, positionCapabilities: [] }, capability), true);
    }
  }
});
