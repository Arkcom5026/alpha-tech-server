const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const {
  activeWarrantyClaims,
  assertRepairCanComplete,
} = require('../src/modules/repair/policies/repairCompletionPolicy');
const {
  RepairFailureCode,
} = require('../src/modules/repair/contracts/repairError');

function verifyClaimProjection() {
  const active = activeWarrantyClaims({
    warrantyClaims: [
      { id: 1, status: 'DRAFT' },
      { id: 2, status: 'REPAIRING' },
      { id: 3, status: 'RESOLVED' },
      { id: 4, status: 'CANCELLED' },
    ],
  });

  assert.deepEqual(
    active.map((claim) => claim.id),
    [1, 2]
  );
}

function verifyCompletionPolicy() {
  assert.throws(
    () => assertRepairCanComplete({ serviceAssetId: null, warrantyClaims: [] }),
    (error) => error.code === RepairFailureCode.SERVICE_ASSET_REQUIRED
  );

  assert.throws(
    () =>
      assertRepairCanComplete({
        serviceAssetId: 10,
        warrantyClaims: [{ id: 20, claimNo: 'WC-20', status: 'SUBMITTED' }],
      }),
    (error) =>
      error.code === RepairFailureCode.ACTIVE_CLAIM_BLOCKS_COMPLETION &&
      error.details.warrantyClaims.length === 1
  );

  assert.doesNotThrow(() =>
    assertRepairCanComplete({
      serviceAssetId: 10,
      warrantyClaims: [
        { id: 21, status: 'RESOLVED' },
        { id: 22, status: 'CANCELLED' },
      ],
    })
  );
}

function verifyRuntimeWiring() {
  const serviceSource = fs.readFileSync(
    path.join(
      __dirname,
      '../src/modules/repair/services/repairCompletionService.js'
    ),
    'utf8'
  );
  const controllerSource = fs.readFileSync(
    path.join(
      __dirname,
      '../src/modules/repair/controllers/repairController.js'
    ),
    'utf8'
  );

  assert.match(serviceSource, /assertRepairCanComplete\(job\)/);
  assert.match(serviceSource, /status:\s*'COMPLETED'/);
  assert.match(serviceSource, /this\.repository\.transaction/);
  assert.match(controllerSource, /requestedStatus\s*===\s*'COMPLETED'/);
  assert.match(
    controllerSource,
    /repairCompletionService\.completeRepairJob/
  );
}

verifyClaimProjection();
verifyCompletionPolicy();
verifyRuntimeWiring();

console.log('Repair Job Completion Guard: PASS');
