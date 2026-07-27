const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertRepairCanOpenClaim,
  assertNoActiveClaimForJob,
  assertResolutionRequirements,
} = require('./warrantyClaimPolicy');

test('requires an existing non-terminal repair job linked to stock or device identity', () => {
  assert.throws(() => assertRepairCanOpenClaim(null), {
    code: 'REPAIR_JOB_NOT_FOUND',
    status: 'fail',
  });
  assert.throws(
    () => assertRepairCanOpenClaim({ status: 'COMPLETED', stockItemId: 1, stockItem: {} }),
    { code: 'REPAIR_JOB_TERMINAL', status: 'fail' }
  );
  assert.throws(
    () => assertRepairCanOpenClaim({
      status: 'IN_PROGRESS',
      stockItemId: null,
      stockItem: null,
      deviceId: null,
      device: null,
    }),
    { code: 'WARRANTY_STOCK_ITEM_REQUIRED', status: 'fail' }
  );
  assert.doesNotThrow(() =>
    assertRepairCanOpenClaim({ status: 'IN_PROGRESS', stockItemId: 1, stockItem: { id: 1 } })
  );
  assert.doesNotThrow(() =>
    assertRepairCanOpenClaim({
      status: 'IN_PROGRESS',
      stockItemId: null,
      stockItem: null,
      deviceId: 2,
      device: { id: 2 },
    })
  );
});

test('blocks an active claim for the same repair job', () => {
  assert.throws(
    () => assertNoActiveClaimForJob({ warrantyClaims: [{ id: 9, claimNo: 'CL-9', status: 'REPAIRING' }] }),
    (error) => {
      assert.equal(error.code, 'WARRANTY_ACTIVE_CLAIM_EXISTS');
      assert.deepEqual(error.details, {
        warrantyClaimId: 9,
        claimNo: 'CL-9',
        status: 'REPAIRING',
      });
      return true;
    }
  );
  assert.doesNotThrow(() => assertNoActiveClaimForJob({ warrantyClaims: [{ status: 'RESOLVED' }] }));
  assert.doesNotThrow(() => assertNoActiveClaimForJob({}));
});

test('requires a resolution only when closing a claim', () => {
  assert.doesNotThrow(() => assertResolutionRequirements({ status: 'INSPECTING' }));
  assert.throws(() => assertResolutionRequirements({ status: 'RESOLVED', resolution: null }), {
    code: 'WARRANTY_RESOLUTION_REQUIRED',
    status: 'fail',
  });
});

test('requires replacement identity for REPLACED resolution', () => {
  assert.throws(
    () => assertResolutionRequirements({ status: 'RESOLVED', resolution: 'REPLACED', replacementStockItemId: null }),
    { code: 'WARRANTY_REPLACEMENT_REQUIRED', status: 'fail' }
  );
  assert.doesNotThrow(() =>
    assertResolutionRequirements({ status: 'RESOLVED', resolution: 'REPLACED', replacementStockItemId: 88 })
  );
});

test('requires an explicit credit amount for CREDITED resolution including zero', () => {
  assert.throws(
    () => assertResolutionRequirements({ status: 'RESOLVED', resolution: 'CREDITED', creditAmount: null }),
    { code: 'WARRANTY_CREDIT_REQUIRED', status: 'fail' }
  );
  assert.doesNotThrow(() =>
    assertResolutionRequirements({ status: 'RESOLVED', resolution: 'CREDITED', creditAmount: 0 })
  );
});