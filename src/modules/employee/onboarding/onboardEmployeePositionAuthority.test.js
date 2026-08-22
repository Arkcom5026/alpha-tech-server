'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { canCreateEmployee } = require('./onboardEmployeeService');
const { POSITION_CAPABILITIES } = require('../authorization/employeePositionAuthority');

const MANAGE = POSITION_CAPABILITIES.EMPLOYEE_MANAGE;

test('legacy onboarding authority remains OWNER and MANAGER compatible', () => {
  assert.equal(canCreateEmployee({ role: 'EMPLOYEE', employeeRole: 'OWNER' }), true);
  assert.equal(canCreateEmployee({ role: 'EMPLOYEE', employeeRole: 'MANAGER' }), true);
  assert.equal(canCreateEmployee({ role: 'EMPLOYEE', employeeRole: 'CASHIER' }), false);
  assert.equal(canCreateEmployee({ role: 'EMPLOYEE', employeeRole: 'TECHNICIAN' }), false);
});

test('migrated positions explicitly control employee onboarding', () => {
  assert.equal(canCreateEmployee({ role: 'EMPLOYEE', employeeRole: 'OWNER', positionCapabilities: [] }), false);
  assert.equal(canCreateEmployee({ role: 'EMPLOYEE', employeeRole: 'CASHIER', positionCapabilities: [MANAGE] }), true);
});

test('platform admins retain employee onboarding authority', () => {
  assert.equal(canCreateEmployee({ role: 'ADMIN', positionCapabilities: [] }), true);
  assert.equal(canCreateEmployee({ role: 'SUPERADMIN', positionCapabilities: [] }), true);
});
