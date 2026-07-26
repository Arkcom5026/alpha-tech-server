const test = require('node:test');
const assert = require('node:assert/strict');
const {
  REPAIR_TRANSITIONS,
  CLAIM_TRANSITIONS,
  assertRepairTransition,
  assertClaimTransition,
} = require('./repairTransitionPolicy');

test('allows every declared repair transition', () => {
  for (const [current, nextStatuses] of Object.entries(REPAIR_TRANSITIONS)) {
    for (const next of nextStatuses) {
      assert.doesNotThrow(() => assertRepairTransition(current, next));
    }
  }
});

test('rejects invalid and repeated repair transitions with transition context', () => {
  assert.throws(
    () => assertRepairTransition('COMPLETED', 'IN_PROGRESS'),
    (error) => {
      assert.equal(error.code, 'REPAIR_INVALID_TRANSITION');
      assert.equal(error.status, 'fail');
      assert.deepEqual(error.details, {
        currentStatus: 'COMPLETED',
        nextStatus: 'IN_PROGRESS',
        allowed: [],
      });
      return true;
    }
  );

  assert.throws(
    () => assertRepairTransition('RECEIVED', 'RECEIVED'),
    { code: 'REPAIR_INVALID_TRANSITION' }
  );
});

test('allows every declared claim transition', () => {
  for (const [current, nextStatuses] of Object.entries(CLAIM_TRANSITIONS)) {
    for (const next of nextStatuses) {
      assert.doesNotThrow(() => assertClaimTransition(current, next));
    }
  }
});

test('rejects terminal, unknown and skipped claim transitions', () => {
  assert.throws(
    () => assertClaimTransition('RESOLVED', 'DRAFT'),
    { code: 'WARRANTY_INVALID_TRANSITION', status: 'fail' }
  );
  assert.throws(
    () => assertClaimTransition('UNKNOWN', 'SUBMITTED'),
    { code: 'WARRANTY_INVALID_TRANSITION' }
  );
  assert.throws(
    () => assertClaimTransition('DRAFT', 'RESOLVED'),
    { code: 'WARRANTY_INVALID_TRANSITION' }
  );
});