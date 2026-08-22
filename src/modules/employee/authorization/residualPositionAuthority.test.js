'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RESIDUAL_POSITION_CAPABILITIES,
  hasResidualCapability,
  resolveResidualCapabilities,
} = require('./residualPositionAuthority');

test('legacy employees preserve grouped residual compatibility', () => {
  const technician = {
    employeeId: 11,
    profileType: 'employee',
    employeeRole: 'TECHNICIAN',
  };
  assert.equal(hasResidualCapability(technician, RESIDUAL_POSITION_CAPABILITIES.COMMUNICATION_READ), true);
  assert.equal(hasResidualCapability(technician, RESIDUAL_POSITION_CAPABILITIES.COMMUNICATION_OPERATE), true);
  assert.equal(hasResidualCapability(technician, RESIDUAL_POSITION_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE), false);
  assert.equal(hasResidualCapability(technician, RESIDUAL_POSITION_CAPABILITIES.STORE_EXPERIENCE_PUBLISH), true);
  assert.equal(hasResidualCapability(technician, RESIDUAL_POSITION_CAPABILITIES.PRODUCT_TRACE_READ), true);
  assert.equal(hasResidualCapability(technician, RESIDUAL_POSITION_CAPABILITIES.PRODUCT_TRACE_FINANCIALS), false);
});

test('legacy owner keeps elevated communication and trace financial authority', () => {
  const owner = { employeeId: 12, profileType: 'employee', employeeRole: 'OWNER' };
  assert.equal(hasResidualCapability(owner, RESIDUAL_POSITION_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE), true);
  assert.equal(hasResidualCapability(owner, RESIDUAL_POSITION_CAPABILITIES.PRODUCT_TRACE_FINANCIALS), true);
});

test('migrated position capabilities are authoritative including an empty array', () => {
  const migrated = {
    employeeId: 12,
    profileType: 'employee',
    employeeRole: 'OWNER',
    positionCapabilities: [RESIDUAL_POSITION_CAPABILITIES.COMMUNICATION_READ],
  };
  assert.equal(resolveResidualCapabilities(migrated).mode, 'POSITION');
  assert.equal(hasResidualCapability(migrated, RESIDUAL_POSITION_CAPABILITIES.COMMUNICATION_READ), true);
  assert.equal(hasResidualCapability(migrated, RESIDUAL_POSITION_CAPABILITIES.PRODUCT_TRACE_FINANCIALS), false);

  const empty = { ...migrated, positionCapabilities: [] };
  assert.equal(hasResidualCapability(empty, RESIDUAL_POSITION_CAPABILITIES.COMMUNICATION_READ), false);
  assert.equal(hasResidualCapability(empty, RESIDUAL_POSITION_CAPABILITIES.STORE_EXPERIENCE_READ), false);
});

test('platform admins receive all grouped residual capabilities', () => {
  const admin = { role: 'ADMIN', positionCapabilities: [] };
  for (const capability of Object.values(RESIDUAL_POSITION_CAPABILITIES)) {
    assert.equal(hasResidualCapability(admin, capability), true);
  }
});
