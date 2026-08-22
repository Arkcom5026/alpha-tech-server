'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RESIDUAL_BUSINESS_CAPABILITIES,
  legacyResidualCapabilitiesForRole,
  resolveResidualBusinessCapabilities,
  hasResidualBusinessCapability,
} = require('./residualBusinessPositionAuthority');

test('legacy residual authority preserves historical employee boundaries', () => {
  const owner = legacyResidualCapabilitiesForRole('OWNER');
  const manager = legacyResidualCapabilitiesForRole('MANAGER');
  const cashier = legacyResidualCapabilitiesForRole('CASHIER');
  const technician = legacyResidualCapabilitiesForRole('TECHNICIAN');

  for (const capabilities of [owner, manager]) {
    assert.equal(capabilities.includes(RESIDUAL_BUSINESS_CAPABILITIES.COMMUNICATION_OPERATE), true);
    assert.equal(capabilities.includes(RESIDUAL_BUSINESS_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE), true);
    assert.equal(capabilities.includes(RESIDUAL_BUSINESS_CAPABILITIES.STORE_EXPERIENCE_PUBLISH), true);
    assert.equal(capabilities.includes(RESIDUAL_BUSINESS_CAPABILITIES.PRODUCT_TRACE_FINANCIALS), true);
  }

  for (const capabilities of [cashier, technician]) {
    assert.equal(capabilities.includes(RESIDUAL_BUSINESS_CAPABILITIES.COMMUNICATION_OPERATE), true);
    assert.equal(capabilities.includes(RESIDUAL_BUSINESS_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE), false);
    assert.equal(capabilities.includes(RESIDUAL_BUSINESS_CAPABILITIES.STORE_EXPERIENCE_READ), true);
    assert.equal(capabilities.includes(RESIDUAL_BUSINESS_CAPABILITIES.STORE_EXPERIENCE_MANAGE), true);
    assert.equal(capabilities.includes(RESIDUAL_BUSINESS_CAPABILITIES.STORE_EXPERIENCE_PUBLISH), true);
    assert.equal(capabilities.includes(RESIDUAL_BUSINESS_CAPABILITIES.PRODUCT_TRACE_FINANCIALS), false);
  }
});

test('migrated position capabilities are authoritative including an explicit empty array', () => {
  const empty = resolveResidualBusinessCapabilities({
    role: 'EMPLOYEE',
    employeeRole: 'OWNER',
    positionCapabilities: [],
  });
  assert.equal(empty.mode, 'POSITION');
  assert.deepEqual(empty.capabilities, []);
  assert.equal(
    hasResidualBusinessCapability(
      { role: 'EMPLOYEE', employeeRole: 'OWNER', positionCapabilities: [] },
      RESIDUAL_BUSINESS_CAPABILITIES.PRODUCT_TRACE_FINANCIALS,
    ),
    false,
  );

  assert.equal(
    hasResidualBusinessCapability(
      {
        role: 'EMPLOYEE',
        employeeRole: 'TECHNICIAN',
        positionCapabilities: [RESIDUAL_BUSINESS_CAPABILITIES.PRODUCT_TRACE_FINANCIALS],
      },
      RESIDUAL_BUSINESS_CAPABILITIES.PRODUCT_TRACE_FINANCIALS,
    ),
    true,
  );
});

test('null or missing position capabilities fall back to v2Role compatibility', () => {
  assert.equal(
    resolveResidualBusinessCapabilities({ role: 'EMPLOYEE', employeeRole: 'MANAGER' }).mode,
    'V2_ROLE_COMPAT',
  );
  assert.equal(
    hasResidualBusinessCapability(
      { role: 'EMPLOYEE', v2Role: 'CASHIER' },
      RESIDUAL_BUSINESS_CAPABILITIES.COMMUNICATION_OPERATE,
    ),
    true,
  );
});

test('platform admins retain all residual business authority', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    for (const capability of Object.values(RESIDUAL_BUSINESS_CAPABILITIES)) {
      assert.equal(
        hasResidualBusinessCapability({ role, positionCapabilities: [] }, capability),
        true,
      );
    }
  }
});
