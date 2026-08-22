'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  OPERATIONAL_RESIDUAL_CAPABILITIES,
  resolveOperationalResidualCapabilities,
  hasOperationalResidualCapability,
} = require('./operationalResidualAuthority');

const C = OPERATIONAL_RESIDUAL_CAPABILITIES;

test('legacy employee compatibility preserves operational residual behavior', () => {
  assert.equal(hasOperationalResidualCapability({ employeeRole: 'TECHNICIAN' }, C.COMMUNICATION_ACCESS), true);
  assert.equal(hasOperationalResidualCapability({ employeeRole: 'TECHNICIAN' }, C.COMMUNICATION_PROFILE_MANAGE), false);
  assert.equal(hasOperationalResidualCapability({ employeeRole: 'CASHIER' }, C.STORE_EXPERIENCE_PUBLISH), true);
  assert.equal(hasOperationalResidualCapability({ employeeRole: 'MANAGER' }, C.PRODUCT_TRACE_FINANCIAL), true);
  assert.equal(hasOperationalResidualCapability({ employeeRole: 'CASHIER' }, C.PRODUCT_TRACE_FINANCIAL), false);
});

test('migrated position capabilities are authoritative including an empty array', () => {
  assert.equal(hasOperationalResidualCapability({ employeeRole: 'OWNER', positionCapabilities: [] }, C.COMMUNICATION_ACCESS), false);
  assert.equal(hasOperationalResidualCapability({ positionCapabilities: [C.COMMUNICATION_ACCESS] }, C.COMMUNICATION_ACCESS), true);
  assert.equal(hasOperationalResidualCapability({ positionCapabilities: [C.STORE_EXPERIENCE_READ] }, C.STORE_EXPERIENCE_MANAGE), false);
  assert.equal(resolveOperationalResidualCapabilities({ positionCapabilities: [] }).mode, 'POSITION');
});

test('platform administrators retain operational residual authority', () => {
  for (const capability of Object.values(C)) {
    assert.equal(hasOperationalResidualCapability({ role: 'ADMIN', positionCapabilities: [] }, capability), true);
    assert.equal(hasOperationalResidualCapability({ role: 'SUPERADMIN', positionCapabilities: [] }, capability), true);
  }
});
