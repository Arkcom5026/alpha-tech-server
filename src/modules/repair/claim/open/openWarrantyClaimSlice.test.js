const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OpenWarrantyClaimRepository,
} = require('./openWarrantyClaimRepository');
const {
  OpenWarrantyClaimService,
} = require('./openWarrantyClaimService');
const {
  RepairFailureCode,
} = require('../../contracts/repairError');

function repairJobFixture(overrides = {}) {
  return {
    id: 51,
    branchId: 3,
    stockItemId: 77,
    status: 'IN_PROGRESS',
    stockItem: {
      purchaseOrderReceiptItem: {
        receipt: {
          supplierId: 12,
          supplier: { id: 12, branchId: 3, active: true },
        },
      },
    },
    warrantyClaims: [],
    ...overrides,
  };
}

function claimFixture(data = {}, event = {}) {
  return {
    id: 61,
    claimNo: data.claimNo || 'WC-3-20260727-TEST',
    branchId: data.branchId || 3,
    stockItemId: data.stockItemId || 77,
    stockItem: {
      id: 77,
      barcode: 'BC-77',
      serialNumber: 'SN-77',
      product: { id: 5, name: 'Notebook', brand: null, productType: null },
    },
    supplierId: data.supplierId || 12,
    supplier: { id: 12, name: 'Supplier' },
    repairJobId: data.repairJobId || 51,
    repairJob: { id: 51, jobNo: 'RE-3-TEST', customer: null },
    repairLinkState: data.repairLinkState || 'LINKED_VERIFIED',
    status: data.status || 'DRAFT',
    reason: data.reason || 'ส่งเคลม',
    serviceProvider: data.serviceProvider || null,
    externalClaimRef: data.externalClaimRef || null,
    trackingNumber: data.trackingNumber || null,
    resolution: null,
    resolutionNote: null,
    creditAmount: null,
    replacementStockItemId: null,
    replacementStockItem: null,
    previousClaimId: null,
    previousClaim: null,
    subsequentClaims: [],
    createdByEmployeeId: data.createdByEmployeeId || 9,
    createdBy: null,
    resolvedByEmployeeId: null,
    resolvedBy: null,
    openedAt: new Date('2026-07-27T00:00:00Z'),
    submittedAt: null,
    providerReceivedAt: null,
    resolvedAt: null,
    cancelledAt: null,
    createdAt: new Date('2026-07-27T00:00:00Z'),
    updatedAt: new Date('2026-07-27T00:00:00Z'),
    events: [
      {
        id: 1,
        warrantyClaimId: 61,
        status: event.status || 'DRAFT',
        note: event.note || 'สร้างรายการเคลมจากใบงานซ่อม',
        metadata: event.metadata || null,
        occurredAt: new Date('2026-07-27T00:00:00Z'),
        performedByEmployeeId: event.performedByEmployeeId || 9,
        performedBy: null,
      },
    ],
  };
}

test('open claim repository keeps repair lookup branch-safe and creates initial event atomically', async () => {
  let findArgs;
  let createArgs;
  const repository = new OpenWarrantyClaimRepository({
    repairJob: {
      findFirst(args) {
        findArgs = args;
        return Promise.resolve(null);
      },
    },
    warrantyClaim: {
      create(args) {
        createArgs = args;
        return Promise.resolve(claimFixture(args.data, args.data.events.create));
      },
    },
  });

  await repository.findRepairJob('3', '51');
  await repository.createWarrantyClaim(
    { branchId: 3, repairJobId: 51, claimNo: 'WC-3-TEST' },
    { status: 'DRAFT', note: 'เริ่มเคลม' }
  );

  assert.deepEqual(findArgs.where, { id: 51, branchId: 3 });
  assert.ok(findArgs.include.stockItem);
  assert.ok(findArgs.include.warrantyClaims);
  assert.equal(createArgs.data.events.create.status, 'DRAFT');
  assert.ok(createArgs.include.events);
});

test('open claim service rejects invalid repair job id before transaction', async () => {
  let called = false;
  const service = new OpenWarrantyClaimService({
    transaction() {
      called = true;
    },
  });

  await assert.rejects(
    () => service.execute(
      { branchId: 3, employeeId: 9 },
      'invalid',
      { reason: 'ส่งเคลม' }
    ),
    (error) => error.code === RepairFailureCode.INVALID_INPUT
  );
  assert.equal(called, false);
});

test('open claim service infers supplier and writes linked draft plus initial event', async () => {
  let createdData;
  let createdEvent;
  const service = new OpenWarrantyClaimService({
    transaction(work) {
      return work({
        findRepairJob(branchId, repairJobId) {
          assert.equal(branchId, 3);
          assert.equal(repairJobId, 51);
          return Promise.resolve(repairJobFixture());
        },
        createWarrantyClaim(data, event) {
          createdData = data;
          createdEvent = event;
          return Promise.resolve(claimFixture(data, event));
        },
      });
    },
  });

  const result = await service.execute(
    { branchId: 3, employeeId: 9 },
    51,
    { reason: ' ส่งเคลม ', note: ' ตรวจรับจากลูกค้าแล้ว ' }
  );

  assert.equal(createdData.branchId, 3);
  assert.equal(createdData.stockItemId, 77);
  assert.equal(createdData.supplierId, 12);
  assert.equal(createdData.repairJobId, 51);
  assert.equal(createdData.repairLinkState, 'LINKED_VERIFIED');
  assert.equal(createdData.status, 'DRAFT');
  assert.match(createdData.claimNo, /^WC-3-/);
  assert.equal(createdEvent.status, 'DRAFT');
  assert.equal(createdEvent.note, 'ตรวจรับจากลูกค้าแล้ว');
  assert.equal(createdEvent.metadata.source, 'REPAIR_JOB');
  assert.equal(result.id, 61);
  assert.equal(result.status, 'DRAFT');
});

test('open claim service preserves supplier mismatch and repeated number conflict contracts', async () => {
  const mismatchService = new OpenWarrantyClaimService({
    transaction(work) {
      return work({
        findRepairJob: () => Promise.resolve(repairJobFixture()),
        findSupplier: () => Promise.resolve({ id: 13, branchId: 3, active: true }),
      });
    },
  });

  await assert.rejects(
    () => mismatchService.execute(
      { branchId: 3, employeeId: 9 },
      51,
      { reason: 'ส่งเคลม', supplierId: 13 }
    ),
    (error) => error.code === RepairFailureCode.WARRANTY_SUPPLIER_MISMATCH
  );

  const uniqueError = Object.assign(new Error('duplicate'), { code: 'P2002' });
  let attempts = 0;
  const conflictService = new OpenWarrantyClaimService({
    transaction() {
      attempts += 1;
      return Promise.reject(uniqueError);
    },
  });

  await assert.rejects(
    () => conflictService.execute(
      { branchId: 3, employeeId: 9 },
      51,
      { reason: 'ส่งเคลม' }
    ),
    (error) => error.code === RepairFailureCode.CONFLICT
  );
  assert.equal(attempts, 2);
});
