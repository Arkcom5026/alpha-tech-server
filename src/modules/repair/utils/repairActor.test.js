const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveRepairActor } = require('./repairActor');

test('prefers direct actor identities and carries position-derived repair capabilities', () => {
  assert.deepEqual(resolveRepairActor({
    id: '5',
    branchId: '7',
    employeeId: '9',
    v2Role: 'MANAGER',
    repairCapabilities: ['repair.intake', 'repair.customer-override', 'repair.intake'],
    positionAuthorityMode: 'POSITION',
  }), {
    branchId: 7,
    employeeId: 9,
    role: 'MANAGER',
    repairCapabilities: ['repair.intake', 'repair.customer-override'],
    positionAuthorityMode: 'POSITION',
    userId: 5,
  });
});

test('falls back to nested employee profile identities without inventing capabilities', () => {
  assert.deepEqual(resolveRepairActor({
    userId: 5,
    employeeProfile: {
      id: 9,
      branchId: 7,
      v2Role: 'STAFF',
    },
  }), {
    branchId: 7,
    employeeId: 9,
    role: 'STAFF',
    repairCapabilities: [],
    positionAuthorityMode: null,
    userId: 5,
  });
});

test('falls back to nested employee identity and keeps legacy role as metadata only', () => {
  assert.deepEqual(resolveRepairActor({
    id: 5,
    role: 'OWNER',
    employee: { id: 9, branchId: 7 },
  }), {
    branchId: 7,
    employeeId: 9,
    role: 'OWNER',
    repairCapabilities: [],
    positionAuthorityMode: null,
    userId: 5,
  });
});

test('rejects missing user context with repair domain error', () => {
  assert.throws(() => resolveRepairActor(null), (error) => {
    assert.equal(error.code, 'REPAIR_ACTOR_CONTEXT_REQUIRED');
    assert.equal(error.status, 'fail');
    assert.equal(error.statusCode, 401);
    return true;
  });
});

test('rejects users without a positive branch identity', () => {
  assert.throws(() => resolveRepairActor({ id: 5, branchId: 0 }), (error) => {
    assert.equal(error.code, 'REPAIR_BRANCH_REQUIRED');
    assert.equal(error.status, 'fail');
    assert.equal(error.statusCode, 403);
    return true;
  });
});

test('allows missing employee identity but never derives it from request data', () => {
  assert.deepEqual(resolveRepairActor({ id: 5, branchId: 7, role: 'STAFF' }), {
    branchId: 7,
    employeeId: null,
    role: 'STAFF',
    repairCapabilities: [],
    positionAuthorityMode: null,
    userId: 5,
  });
});
