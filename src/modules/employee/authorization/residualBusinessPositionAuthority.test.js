const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RESIDUAL_BUSINESS_CAPABILITIES,
  resolveResidualBusinessCapabilities,
  hasResidualBusinessCapability,
} = require('./residualBusinessPositionAuthority');

test('legacy OWNER and MANAGER retain all residual business authority', () => {
  for (const employeeRole of ['OWNER', 'MANAGER']) {
    const resolved = resolveResidualBusinessCapabilities({ role: 'EMPLOYEE', employeeRole });
    assert.equal(resolved.mode, 'V2_ROLE_COMPAT');
    for (const capability of Object.values(RESIDUAL_BUSINESS_CAPABILITIES)) {
      assert.equal(resolved.capabilities.includes(capability), true);
    }
  }
});

test('legacy CASHIER and TECHNICIAN retain historical broad operational access but not elevated profile or financial authority', () => {
  for (const employeeRole of ['CASHIER', 'TECHNICIAN']) {
    const actor = { role: 'EMPLOYEE', employeeRole };
    assert.equal(hasResidualBusinessCapability(actor, RESIDUAL_BUSINESS_CAPABILITIES.COMMUNICATION_ACCESS), true);
    assert.equal(hasResidualBusinessCapability(actor, RESIDUAL_BUSINESS_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE), false);
    assert.equal(hasResidualBusinessCapability(actor, RESIDUAL_BUSINESS_CAPABILITIES.PRODUCT_TRACE_READ), true);
    assert.equal(hasResidualBusinessCapability(actor, RESIDUAL_BUSINESS_CAPABILITIES.PRODUCT_TRACE_FINANCIAL), false);
    assert.equal(hasResidualBusinessCapability(actor, RESIDUAL_BUSINESS_CAPABILITIES.STORE_EXPERIENCE_READ), true);
    assert.equal(hasResidualBusinessCapability(actor, RESIDUAL_BUSINESS_CAPABILITIES.STORE_EXPERIENCE_MANAGE), true);
    assert.equal(hasResidualBusinessCapability(actor, RESIDUAL_BUSINESS_CAPABILITIES.STORE_EXPERIENCE_PUBLISH), true);
  }
});

test('migrated position arrays are authoritative including an explicit empty array', () => {
  const readOnly = {
    role: 'EMPLOYEE',
    employeeRole: 'OWNER',
    positionCapabilities: [RESIDUAL_BUSINESS_CAPABILITIES.PRODUCT_TRACE_READ],
  };
  assert.equal(resolveResidualBusinessCapabilities(readOnly).mode, 'POSITION');
  assert.equal(hasResidualBusinessCapability(readOnly, RESIDUAL_BUSINESS_CAPABILITIES.PRODUCT_TRACE_READ), true);
  assert.equal(hasResidualBusinessCapability(readOnly, RESIDUAL_BUSINESS_CAPABILITIES.PRODUCT_TRACE_FINANCIAL), false);

  const empty = { role: 'EMPLOYEE', employeeRole: 'OWNER', positionCapabilities: [] };
  assert.equal(resolveResidualBusinessCapabilities(empty).mode, 'POSITION');
  assert.equal(hasResidualBusinessCapability(empty, RESIDUAL_BUSINESS_CAPABILITIES.COMMUNICATION_ACCESS), false);
  assert.equal(hasResidualBusinessCapability(empty, RESIDUAL_BUSINESS_CAPABILITIES.STORE_EXPERIENCE_PUBLISH), false);
});

test('platform admins retain all residual business authority regardless of position state', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    const actor = { role, positionCapabilities: [] };
    for (const capability of Object.values(RESIDUAL_BUSINESS_CAPABILITIES)) {
      assert.equal(hasResidualBusinessCapability(actor, capability), true);
    }
  }
});
