'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canManageEmployees,
  allowEmployeeManagement,
} = require('./employeeManagementAuthorization');

const invoke = (user) => new Promise((resolve) => {
  const req = { user };
  const res = {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; resolve({ nextCalled: false, res: this }); },
  };
  allowEmployeeManagement(req, res, () => resolve({ nextCalled: true, res }));
});

test('legacy generic employee mutations preserve historical authenticated employee access', () => {
  for (const employeeRole of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    assert.equal(canManageEmployees({ role: 'EMPLOYEE', employeeRole }), true, employeeRole);
  }
});

test('migrated positions require explicit employee.manage and empty arrays are authoritative', async () => {
  assert.equal(canManageEmployees({
    role: 'EMPLOYEE',
    employeeRole: 'OWNER',
    positionCapabilities: [],
  }), false);

  assert.equal(canManageEmployees({
    role: 'EMPLOYEE',
    employeeRole: 'CASHIER',
    positionCapabilities: ['employee.manage'],
  }), true);

  const denied = await invoke({
    role: 'EMPLOYEE',
    employeeRole: 'MANAGER',
    positionCapabilities: [],
  });
  assert.equal(denied.nextCalled, false);
  assert.equal(denied.res.statusCode, 403);
  assert.deepEqual(denied.res.payload.details.requiredCapabilities, ['employee.manage']);
});

test('platform admins retain employee management authority', () => {
  assert.equal(canManageEmployees({ role: 'ADMIN', positionCapabilities: [] }), true);
  assert.equal(canManageEmployees({ role: 'SUPERADMIN', positionCapabilities: [] }), true);
  assert.equal(canManageEmployees({ role: 'CUSTOMER' }), false);
});

test('employee routes gate create update and activation but keep reads and hard-delete contract intact', () => {
  const source = fs.readFileSync(path.join(__dirname, '../routes/employeeRoutes.js'), 'utf8');

  assert.match(source, /router\.get\('\/', getAllEmployees\)/);
  assert.match(source, /router\.get\('\/:id', getEmployeesById\)/);
  assert.match(source, /router\.post\('\/', allowEmployeeManagement, createEmployeeController\)/);
  assert.match(source, /router\.put\('\/:id', allowEmployeeManagement, updateEmployeeController\)/);
  assert.match(source, /router\.patch\('\/:id\/status', allowEmployeeManagement, toggleEmployeeStatus\)/);
  assert.match(source, /router\.delete\('\/:id', deleteEmployee\)/);
});
