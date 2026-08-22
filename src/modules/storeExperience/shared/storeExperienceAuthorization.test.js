const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isStoreExperienceEmployeeContext,
  allowStoreExperienceManage,
} = require('./storeExperienceAuthorization');

const runGuard = (req) => {
  let nextCalled = false;
  let statusCode = null;
  let payload = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      payload = value;
      return this;
    },
  };
  allowStoreExperienceManage(req, res, () => { nextCalled = true; });
  return { nextCalled, statusCode, payload };
};

test('legacy employee roles preserve historical store experience management access', () => {
  for (const employeeRole of ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']) {
    const result = runGuard({
      user: {
        profileType: 'employee',
        role: 'EMPLOYEE',
        employeeRole,
      },
    });
    assert.equal(result.nextCalled, true, employeeRole);
  }
});

test('migrated positions require explicit store experience manage capability', () => {
  assert.equal(runGuard({
    user: {
      profileType: 'employee',
      role: 'EMPLOYEE',
      employeeRole: 'OWNER',
      positionCapabilities: [],
    },
  }).statusCode, 403);

  assert.equal(runGuard({
    user: {
      profileType: 'employee',
      role: 'EMPLOYEE',
      employeeRole: 'CASHIER',
      positionCapabilities: ['store-experience.manage'],
    },
  }).nextCalled, true);
});

test('platform admins retain store experience authority', () => {
  assert.equal(runGuard({ user: { role: 'ADMIN' } }).nextCalled, true);
  assert.equal(runGuard({ user: { role: 'SUPERADMIN', positionCapabilities: [] } }).nextCalled, true);
});

test('non-employee contexts remain forbidden', () => {
  assert.equal(isStoreExperienceEmployeeContext({ user: { role: 'CUSTOMER' } }), false);
  const result = runGuard({ user: { role: 'CUSTOMER' } });
  assert.equal(result.statusCode, 403);
  assert.equal(result.payload.code, 'FORBIDDEN_STORE_EXPERIENCE_ACCESS');
});
