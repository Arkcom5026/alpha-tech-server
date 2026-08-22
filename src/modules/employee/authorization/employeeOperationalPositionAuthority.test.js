const test = require('node:test');
const assert = require('node:assert/strict');
const {
  OPERATIONAL_POSITION_CAPABILITIES,
  legacyOperationalCapabilitiesForRole,
  resolveOperationalActorCapabilities,
  hasOperationalCapability,
} = require('./employeeOperationalPositionAuthority');

test('legacy owner and manager retain all operational residual authority', () => {
  for (const role of ['OWNER', 'MANAGER']) {
    const capabilities = legacyOperationalCapabilitiesForRole(role);
    for (const capability of Object.values(OPERATIONAL_POSITION_CAPABILITIES)) {
      assert.equal(capabilities.includes(capability), true, `${role} missing ${capability}`);
    }
  }
});

test('legacy cashier and technician preserve operational access without elevated profile or financial authority', () => {
  for (const role of ['CASHIER', 'TECHNICIAN']) {
    const actor = { role: 'EMPLOYEE', employeeRole: role };
    assert.equal(hasOperationalCapability(actor, OPERATIONAL_POSITION_CAPABILITIES.COMMUNICATION_OPERATE), true);
    assert.equal(hasOperationalCapability(actor, OPERATIONAL_POSITION_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE), false);
    assert.equal(hasOperationalCapability(actor, OPERATIONAL_POSITION_CAPABILITIES.STORE_EXPERIENCE_READ), true);
    assert.equal(hasOperationalCapability(actor, OPERATIONAL_POSITION_CAPABILITIES.STORE_EXPERIENCE_MANAGE), true);
    assert.equal(hasOperationalCapability(actor, OPERATIONAL_POSITION_CAPABILITIES.STORE_EXPERIENCE_PUBLISH), true);
    assert.equal(hasOperationalCapability(actor, OPERATIONAL_POSITION_CAPABILITIES.PRODUCT_TRACE_READ), true);
    assert.equal(hasOperationalCapability(actor, OPERATIONAL_POSITION_CAPABILITIES.PRODUCT_TRACE_FINANCIALS), false);
  }
});

test('migrated position capabilities are authoritative including explicit empty arrays', () => {
  const allowed = {
    role: 'EMPLOYEE',
    employeeRole: 'OWNER',
    positionCapabilities: [OPERATIONAL_POSITION_CAPABILITIES.PRODUCT_TRACE_READ],
  };
  assert.equal(resolveOperationalActorCapabilities(allowed).mode, 'POSITION');
  assert.equal(hasOperationalCapability(allowed, OPERATIONAL_POSITION_CAPABILITIES.PRODUCT_TRACE_READ), true);
  assert.equal(hasOperationalCapability(allowed, OPERATIONAL_POSITION_CAPABILITIES.PRODUCT_TRACE_FINANCIALS), false);

  const denied = { role: 'EMPLOYEE', employeeRole: 'OWNER', positionCapabilities: [] };
  assert.equal(resolveOperationalActorCapabilities(denied).mode, 'POSITION');
  assert.equal(hasOperationalCapability(denied, OPERATIONAL_POSITION_CAPABILITIES.COMMUNICATION_OPERATE), false);
  assert.equal(hasOperationalCapability(denied, OPERATIONAL_POSITION_CAPABILITIES.STORE_EXPERIENCE_READ), false);
});

test('platform admins retain all operational residual authority', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    for (const capability of Object.values(OPERATIONAL_POSITION_CAPABILITIES)) {
      assert.equal(hasOperationalCapability({ role, positionCapabilities: [] }, capability), true);
    }
  }
});

test('generic legacy employee context preserves historical base operational access', () => {
  const actor = { role: 'EMPLOYEE', profileType: 'employee', employeeId: 88 };
  assert.equal(hasOperationalCapability(actor, OPERATIONAL_POSITION_CAPABILITIES.COMMUNICATION_OPERATE), true);
  assert.equal(hasOperationalCapability(actor, OPERATIONAL_POSITION_CAPABILITIES.STORE_EXPERIENCE_PUBLISH), true);
  assert.equal(hasOperationalCapability(actor, OPERATIONAL_POSITION_CAPABILITIES.PRODUCT_TRACE_READ), true);
  assert.equal(hasOperationalCapability(actor, OPERATIONAL_POSITION_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE), false);
});
