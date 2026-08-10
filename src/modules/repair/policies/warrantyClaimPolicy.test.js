const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CLAIM_OPENABLE_WORKFLOW_STATUSES,
  assertRepairCanOpenClaim,
  assertNoActiveClaimForJob,
  assertResolutionRequirements,
} = require('./warrantyClaimPolicy');

const linkedJob = (overrides = {}) => ({
  status: 'IN_PROGRESS',
  stockItemId: 1,
  stockItem: { id: 1 },
  ...overrides,
});

test('requires an existing non-terminal repair job linked to stock or device identity', () => {
  assert.throws(() => assertRepairCanOpenClaim(null, 'DIAGNOSING'), {
    code: 'REPAIR_JOB_NOT_FOUND',
    status: 'fail',
  });
  assert.throws(
    () => assertRepairCanOpenClaim({ status: 'COMPLETED', stockItemId: 1, stockItem: {} }, 'REPAIRING'),
    { code: 'REPAIR_JOB_TERMINAL', status: 'fail' }
  );
  assert.throws(
    () => assertRepairCanOpenClaim({
      status: 'IN_PROGRESS',
      stockItemId: null,
      stockItem: null,
      deviceId: null,
      device: null,
    }, 'DIAGNOSING'),
    { code: 'WARRANTY_STOCK_ITEM_REQUIRED', status: 'fail' }
  );
  assert.doesNotThrow(() => assertRepairCanOpenClaim(linkedJob(), 'DIAGNOSING'));
  assert.doesNotThrow(() =>
    assertRepairCanOpenClaim({
      status: 'IN_PROGRESS',
      stockItemId: null,
      stockItem: null,
      deviceId: 2,
      device: { id: 2 },
    }, 'REPAIRING')
  );
});

test('claim opening is optional only after diagnosis starts and before delivery', () => {
  for (const status of CLAIM_OPENABLE_WORKFLOW_STATUSES) {
    assert.doesNotThrow(() => assertRepairCanOpenClaim(linkedJob(), status));
  }

  for (const status of ['RECEIVED', 'WAITING_DIAGNOSIS', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED', 'CANCELLED']) {
    assert.throws(
      () => assertRepairCanOpenClaim(linkedJob(), status),
      (error) => {
        assert.equal(error.code, 'REPAIR_CONFLICT');
        assert.equal(error.statusCode, 409);
        assert.equal(error.details.workflowStatus, status);
        return true;
      }
    );
  }
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