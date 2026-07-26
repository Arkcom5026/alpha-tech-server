const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GetWarrantyClaimRepository,
} = require('./getWarrantyClaimRepository');
const {
  GetWarrantyClaimService,
} = require('./getWarrantyClaimService');
const {
  RepairFailureCode,
} = require('../../../contracts/repairError');

function claimFixture() {
  return {
    id: 51,
    claimNo: 'CL-4-20260727-TEST',
    branchId: 4,
    stockItemId: null,
    stockItem: null,
    repairJobId: 31,
    repairJob: {
      id: 31,
      jobNo: 'RE-4-20260727-TEST',
      status: 'IN_PROGRESS',
      customerId: 7,
      customer: { name: 'Customer' },
    },
    repairLinkState: 'LINKED_VERIFIED',
    supplierId: 8,
    supplier: {
      id: 8,
      name: 'Supplier',
      phone: '0800000000',
      email: 'supplier@example.com',
    },
    status: 'DRAFT',
    reason: 'Warranty issue',
    serviceProvider: null,
    externalClaimRef: null,
    trackingNumber: null,
    resolution: null,
    resolutionNote: null,
    replacementStockItemId: null,
    creditAmount: null,
    openedAt: new Date('2026-07-27T00:00:00Z'),
    submittedAt: null,
    providerReceivedAt: null,
    resolvedAt: null,
    cancelledAt: null,
    events: [],
    createdAt: new Date('2026-07-27T00:00:00Z'),
    updatedAt: new Date('2026-07-27T00:00:00Z'),
  };
}

test('claim detail repository scopes id lookup by branch and loads full detail graph', async () => {
  let received;
  const repository = new GetWarrantyClaimRepository({
    warrantyClaim: {
      findFirst(args) {
        received = args;
        return Promise.resolve(null);
      },
    },
  });

  await repository.findById('4', '51');

  assert.deepEqual(received.where, { id: 51, branchId: 4 });
  assert.ok(received.include.stockItem);
  assert.ok(received.include.supplier);
  assert.ok(received.include.repairJob);
  assert.ok(received.include.previousClaim);
  assert.ok(received.include.subsequentClaims);
  assert.ok(received.include.replacementStockItem);
  assert.ok(received.include.createdBy);
  assert.ok(received.include.resolvedBy);
  assert.ok(received.include.events);
});

test('claim detail service validates claim id before repository access', async () => {
  let called = false;
  const service = new GetWarrantyClaimService({
    findById() {
      called = true;
      return Promise.resolve(null);
    },
  });

  await assert.rejects(
    () => service.execute({ branchId: 4 }, 'invalid'),
    (error) => {
      assert.equal(error.code, RepairFailureCode.INVALID_INPUT);
      assert.equal(error.statusCode, 400);
      assert.deepEqual(error.details, { field: 'warrantyClaimId' });
      return true;
    }
  );
  assert.equal(called, false);
});

test('claim detail service maps result and preserves branch-safe not-found contract', async () => {
  const successService = new GetWarrantyClaimService({
    findById(branchId, warrantyClaimId) {
      assert.equal(branchId, 4);
      assert.equal(warrantyClaimId, 51);
      return Promise.resolve(claimFixture());
    },
  });

  const result = await successService.execute({ branchId: 4 }, '51');
  assert.equal(result.id, 51);
  assert.equal(result.claimNo, 'CL-4-20260727-TEST');
  assert.equal(result.repairJob.id, 31);
  assert.equal(result.supplier.id, 8);

  const notFoundService = new GetWarrantyClaimService({
    findById() {
      return Promise.resolve(null);
    },
  });

  await assert.rejects(
    () => notFoundService.execute({ branchId: 4 }, 999),
    (error) => {
      assert.equal(error.code, RepairFailureCode.WARRANTY_CLAIM_NOT_FOUND);
      assert.equal(error.statusCode, 404);
      return true;
    }
  );
});
