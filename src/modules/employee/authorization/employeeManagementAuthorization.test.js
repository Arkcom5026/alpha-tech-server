'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { requireEmployeeManage } = require('./employeeManagementAuthorization');

const invoke = (user) => {
  const response = {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
  let nextCalled = false;
  requireEmployeeManage({ user }, response, () => { nextCalled = true; });
  return { response, nextCalled };
};

test('legacy owner and manager retain employee management while cashier and technician do not', () => {
  assert.equal(invoke({ employeeId: 1, employeeRole: 'OWNER' }).nextCalled, true);
  assert.equal(invoke({ employeeId: 2, employeeRole: 'MANAGER' }).nextCalled, true);
  assert.equal(invoke({ employeeId: 3, employeeRole: 'CASHIER' }).nextCalled, false);
  assert.equal(invoke({ employeeId: 4, employeeRole: 'TECHNICIAN' }).nextCalled, false);
});

test('migrated position requires explicit employee.manage and empty array is authoritative', () => {
  assert.equal(invoke({
    employeeId: 1,
    employeeRole: 'CASHIER',
    positionCapabilities: ['employee.manage'],
  }).nextCalled, true);
  const denied = invoke({
    employeeId: 1,
    employeeRole: 'OWNER',
    positionCapabilities: [],
  });
  assert.equal(denied.nextCalled, false);
  assert.equal(denied.response.statusCode, 403);
});

test('platform admins retain employee management authority', () => {
  assert.equal(invoke({ role: 'ADMIN', positionCapabilities: [] }).nextCalled, true);
  assert.equal(invoke({ role: 'SUPERADMIN', positionCapabilities: [] }).nextCalled, true);
});

test('canonical employee mutation routes use employee.manage while hard delete remains disabled', () => {
  const routeSource = fs.readFileSync(path.join(__dirname, '../routes/employeeRoutes.js'), 'utf8');
  assert.match(routeSource, /router\.post\('\/', requireEmployeeManage, createEmployeeController\)/);
  assert.match(routeSource, /router\.put\('\/:id', requireEmployeeManage, updateEmployeeController\)/);
  assert.match(routeSource, /router\.patch\('\/:id\/status', requireEmployeeManage, toggleEmployeeStatus\)/);
  assert.match(routeSource, /router\.delete\('\/:id', deleteEmployee\)/);
});
