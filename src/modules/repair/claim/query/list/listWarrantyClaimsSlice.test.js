const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ListWarrantyClaimsRepository,
} = require('./listWarrantyClaimsRepository');
const {
  ListWarrantyClaimsService,
  validateListWarrantyClaimsQuery,
} = require('./listWarrantyClaimsService');
const { RepairFailureCode } = require('../../../contracts/repairError');

function claimFixture() {
  return {
    id: 51,
    claimNo: 'CL-4-20260727-ABC',
    branchId: 4,
    stockItemId: 12,
    stockItem: null,
    repairJobId: 31,
    repairJob: {
      id: 31,
      jobNo: 'RE-4-20260727-ABC',
      status: 'IN_PROGRESS',
      customerId: 7,
      customer: { name: 'Customer' },
    },
    repairLinkState: 'LINKED_VERIFIED',
    supplier: { id: 8, name: 'Supplier', phone: null, email: null },
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

test('list claims repository always scopes query by branch and normalized filters', async () => {
  let received;
  const repository = new ListWarrantyClaimsRepository({
    warrantyClaim: {
      findMany(args) {
        received = args;
        return Promise.resolve([]);
      },
    },
  });

  await repository.findMany('4', {
    status: 'DRAFT',
    stockItemId: 12,
    limit: 25,
    offset: 5,
  });

  assert.deepEqual(received.where, {
    branchId: 4,
    status: 'DRAFT',
    stockItemId: 12,
  });
  assert.equal(received.take, 25);
  assert.equal(received.skip, 5);
  assert.deepEqual(received.orderBy, { openedAt: 'desc' });
  assert.ok(received.include.stockItem);
  assert.ok(received.include.repairJob);
  assert.ok(received.include.events);
});

test('list claims validation normalizes filters and clamps pagination', () => {
  assert.deepEqual(
    validateListWarrantyClaimsQuery({
      status: ' draft ',
      stockItemId: '12',
      limit: '999',
      offset: '-5',
    }),
    {
      status: 'DRAFT',
      stockItemId: 12,
      limit: 100,
      offset: 0,
    }
  );

  assert.throws(
    () => validateListWarrantyClaimsQuery({ stockItemId: 'bad' }),
    (error) => {
      assert.equal(error.code, RepairFailureCode.INVALID_INPUT);
      assert.deepEqual(error.details, { field: 'stockItemId' });
      return true;
    }
  );
});

test('list claims service calls slice repository and maps warranty claims', async () => {
  const service = new ListWarrantyClaimsService({
    findMany(branchId, filters) {
      assert.equal(branchId, 4);
      assert.deepEqual(filters, {
        status: 'DRAFT',
        stockItemId: 12,
        limit: 20,
        offset: 0,
      });
      return Promise.resolve([claimFixture()]);
    },
  });

  const result = await service.execute(
    { branchId: 4 },
    { status: 'draft', stockItemId: '12', limit: '20' }
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].id, 51);
  assert.equal(result[0].claimNo, 'CL-4-20260727-ABC');
  assert.equal(result[0].supplier.name, 'Supplier');
  assert.equal(result[0].repairJob.id, 31);
});
