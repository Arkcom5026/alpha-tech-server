const test = require('node:test');
const assert = require('node:assert/strict');

const {
  UpdateWarrantyClaimStatusRepository,
} = require('./updateWarrantyClaimStatusRepository');
const {
  UpdateWarrantyClaimStatusService,
  positiveClaimId,
  claimTimestampData,
} = require('./updateWarrantyClaimStatusService');
const {
  RepairFailureCode,
} = require('../../contracts/repairError');

function claimFixture(overrides = {}) {
  return {
    id: 31,
    claimNo: 'WC-TEST-31',
    branchId: 4,
    stockItemId: 12,
    stockItem: null,
    repairJobId: 18,
    repairJob: null,
    repairLinkState: 'LINKED_VERIFIED',
    supplier: null,
    status: 'DRAFT',
    reason: 'ส่งตรวจสอบ',
    serviceProvider: null,
    externalClaimRef: null,
    trackingNumber: null,
    resolution: null,
    resolutionNote: null,
    replacementStockItemId: null,
    creditAmount: null,
    openedAt: new Date('2026-07-27T00:00:00.000Z'),
    submittedAt: null,
    providerReceivedAt: null,
    resolvedAt: null,
    cancelledAt: null,
    events: [],
    createdAt: new Date('2026-07-27T00:00:00.000Z'),
    updatedAt: new Date('2026-07-27T00:00:00.000Z'),
    ...overrides,
  };
}

test('claim status repository keeps lookup branch-safe and writes update plus event atomically', async () => {
  const calls = [];
  const txClient = {
    warrantyClaim: {
      findFirst(args) {
        calls.push(['findFirst', args]);
        return claimFixture();
      },
      update(args) {
        calls.push(['update', args]);
        return claimFixture({ status: 'SUBMITTED' });
      },
    },
    stockItem: {
      findUnique(args) {
        calls.push(['stockItem', args]);
        return { id: 90, branchId: 4 };
      },
    },
  };
  const client = {
    $transaction(work) {
      calls.push(['transaction']);
      return work(txClient);
    },
  };

  const repository = new UpdateWarrantyClaimStatusRepository(client);
  await repository.transaction(async (repo) => {
    await repo.findById(4, 31);
    await repo.findReplacementStockItem(90);
    await repo.updateWithEvent(
      31,
      { status: 'SUBMITTED' },
      { status: 'SUBMITTED', note: 'ส่งแล้ว' }
    );
  });

  assert.deepEqual(calls[1][1].where, { id: 31, branchId: 4 });
  assert.deepEqual(calls[2][1].where, { id: 90 });
  assert.equal(calls[3][1].where.id, 31);
  assert.deepEqual(calls[3][1].data.events.create, {
    status: 'SUBMITTED',
    note: 'ส่งแล้ว',
  });
});

test('claim status service rejects invalid claim id before transaction', async () => {
  let transactions = 0;
  const service = new UpdateWarrantyClaimStatusService({
    transaction() {
      transactions += 1;
    },
  });

  await assert.rejects(
    () => service.execute({ branchId: 4 }, 'invalid', { status: 'SUBMITTED' }),
    (error) => error.code === RepairFailureCode.INVALID_INPUT
  );
  assert.equal(transactions, 0);
  assert.throws(() => positiveClaimId(0), {
    code: RepairFailureCode.INVALID_INPUT,
  });
});

test('claim status service applies transition timestamps and event metadata', async () => {
  let updateCall;
  const service = new UpdateWarrantyClaimStatusService({
    transaction(work) {
      return work({
        findById(branchId, claimId) {
          assert.equal(branchId, 4);
          assert.equal(claimId, 31);
          return claimFixture();
        },
        updateWithEvent(claimId, data, event) {
          updateCall = { claimId, data, event };
          return claimFixture({
            status: data.status,
            submittedAt: data.submittedAt,
            events: [{ id: 1, ...event }],
          });
        },
      });
    },
  });

  const result = await service.execute(
    { branchId: 4, employeeId: 8 },
    31,
    {
      status: 'submitted',
      expectedStatus: 'draft',
      note: 'ส่งผู้ให้บริการ',
      trackingNumber: 'TRACK-1',
    }
  );

  assert.equal(updateCall.claimId, 31);
  assert.equal(updateCall.data.status, 'SUBMITTED');
  assert.ok(updateCall.data.submittedAt instanceof Date);
  assert.equal(updateCall.data.trackingNumber, 'TRACK-1');
  assert.deepEqual(updateCall.event.metadata, {
    previousStatus: 'DRAFT',
    resolution: null,
    replacementStockItemId: null,
    outcome: null,
  });
  assert.equal(updateCall.event.performedByEmployeeId, 8);
  assert.equal(result.status, 'SUBMITTED');
});

test('claim status service rejects stale guided action before write', async () => {
  let wrote = false;
  const service = new UpdateWarrantyClaimStatusService({
    transaction(work) {
      return work({
        findById() {
          return claimFixture({ status: 'IN_TRANSIT' });
        },
        updateWithEvent() {
          wrote = true;
        },
      });
    },
  });

  await assert.rejects(
    () => service.execute(
      { branchId: 4, employeeId: 8 },
      31,
      { status: 'RECEIVED_BY_PROVIDER', expectedStatus: 'SUBMITTED' }
    ),
    (error) => {
      assert.equal(error.code, RepairFailureCode.CONFLICT);
      assert.equal(error.statusCode, 409);
      assert.deepEqual(error.details, {
        expectedStatus: 'SUBMITTED',
        actualStatus: 'IN_TRANSIT',
      });
      return true;
    }
  );
  assert.equal(wrote, false);
});

test('claim status service preserves replacement scope and resolution contracts', async () => {
  const service = new UpdateWarrantyClaimStatusService({
    transaction(work) {
      return work({
        findById() {
          return claimFixture({ status: 'REPLACEMENT_PENDING' });
        },
        findReplacementStockItem() {
          return { id: 90, branchId: 99 };
        },
      });
    },
  });

  await assert.rejects(
    () =>
      service.execute(
        { branchId: 4, employeeId: 8 },
        31,
        {
          status: 'RESOLVED',
          resolution: 'REPLACED',
          replacementStockItemId: 90,
        }
      ),
    (error) => error.code === RepairFailureCode.STOCK_ITEM_NOT_FOUND
  );

  await assert.rejects(
    () =>
      service.execute(
        { branchId: 4, employeeId: 8 },
        31,
        { status: 'RESOLVED' }
      ),
    (error) => error.code === RepairFailureCode.WARRANTY_RESOLUTION_REQUIRED
  );

  const now = new Date('2026-07-27T00:00:00.000Z');
  assert.deepEqual(claimTimestampData('CANCELLED', now), {
    cancelledAt: now,
  });
});
