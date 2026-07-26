const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const {
  assetStatusForClaim,
} = require('../src/modules/repair/services/warrantyClaimService');
const { mapWarrantyClaim } = require('../src/modules/repair/mappers/repairMapper');

function verifyLifecycleProjection() {
  assert.equal(assetStatusForClaim('DRAFT'), 'IN_CLAIM');
  assert.equal(assetStatusForClaim('SUBMITTED'), 'IN_CLAIM');
  assert.equal(assetStatusForClaim('RECEIVED_BY_PROVIDER'), 'IN_CLAIM');
  assert.equal(assetStatusForClaim('RESOLVED'), 'IN_SERVICE');
  assert.equal(assetStatusForClaim('CANCELLED'), 'IN_SERVICE');
}

function verifyClaimMapping() {
  const mapped = mapWarrantyClaim({
    id: 10,
    claimNo: 'WC-1',
    branchId: 1,
    stockItemId: 20,
    serviceAssetId: 30,
    repairJobId: 40,
    repairJob: {
      id: 40,
      jobNo: 'RE-1',
      status: 'DIAGNOSING',
      customerId: 50,
      serviceAssetId: 30,
      customer: { name: 'Customer' },
    },
    repairLinkState: 'LINKED_VERIFIED',
    status: 'DRAFT',
    reason: 'test',
    events: [],
  });

  assert.equal(mapped.serviceAssetId, 30);
  assert.equal(mapped.repairJob.serviceAssetId, 30);
}

function verifyRuntimeWiring() {
  const servicePath = path.join(
    __dirname,
    '../src/modules/repair/services/warrantyClaimService.js'
  );
  const source = fs.readFileSync(servicePath, 'utf8');

  assert.match(source, /serviceAssetId:\s*job\.serviceAssetId/);
  assert.match(source, /status:\s*'IN_CLAIM'/);
  assert.match(source, /assetStatusForClaim\(payload\.status\)/);
  assert.match(source, /SERVICE_ASSET_REQUIRED/);
}

verifyLifecycleProjection();
verifyClaimMapping();
verifyRuntimeWiring();

console.log('Warranty Claim Service Asset Lifecycle: PASS');
