const test = require('node:test');
const assert = require('node:assert/strict');
const { WarrantyClaimService } = require('./warrantyClaimService');

const actor = { branchId: 7, employeeId: 9 };

function claim(overrides = {}) {
  return {
    id: 50,
    claimNo: 'WC-7-20260727-TEST',
    branchId: 7,
    stockItemId: 1,
    stockItem: null,
    repairJobId: 100,
    repairJob: null,
    repairLinkState: 'LINKED_VERIFIED',
    supplier: null,
    supplierId: null,
    status: 'DRAFT',
    reason: 'Warranty issue',
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

function repairJob(overrides = {}) {
  return {
    id: 100,
    jobNo: 'RE-7-TEST',
    status: 'IN_PROGRESS',
    stockItemId: 1,
    stockItem: {
      id: 1,
      branchId: 7,
      purchaseOrderReceiptItem: { receipt: { supplierId: 30 } },
    },
    warrantyClaims: [],
    ...overrides,
  };
}

function transactionRepository(methods = {}) {
  const repo = { ...methods };
  return {
    ...repo,
    async transaction(callback) { return callback(repo); },
  };
}

test('opens a linked draft claim using source supplier and actor identity', async () => {
  let claimData;
  let eventData;
  const service = new WarrantyClaimService(transactionRepository({
    async findRepairJob() { return repairJob(); },
    async createWarrantyClaim(data, event) {
      claimData = data;
      eventData = event;
      return claim({ ...data, supplier: { id: data.supplierId, name: 'Supplier' } });
    },
  }));

  const result = await service.openFromRepairJob(actor, 100, { reason: ' Warranty issue ' });

  assert.equal(claimData.branchId, 7);
  assert.equal(claimData.stockItemId, 1);
  assert.equal(claimData.supplierId, 30);
  assert.equal(claimData.repairJobId, 100);
  assert.equal(claimData.repairLinkState, 'LINKED_VERIFIED');
  assert.equal(claimData.createdByEmployeeId, 9);
  assert.equal(eventData.performedByEmployeeId, 9);
  assert.equal(eventData.metadata.source, 'REPAIR_JOB');
  assert.equal(result.status, 'DRAFT');
});

test('rejects selected supplier that does not match procurement source', async () => {
  const service = new WarrantyClaimService(transactionRepository({
    async findRepairJob() { return repairJob(); },
    async findSupplier() { return { id: 31, branchId: 7, active: true }; },
  }));

  await assert.rejects(
    () => service.openFromRepairJob(actor, 100, { reason: 'Issue', supplierId: 31 }),
    (error) => {
      assert.equal(error.code, 'WARRANTY_SUPPLIER_MISMATCH');
      assert.deepEqual(error.details, { sourceSupplierId: 30, selectedSupplierId: 31 });
      return true;
    }
  );
});

test('retries one unique-number collision and succeeds', async () => {
  let attempts = 0;
  const repository = transactionRepository({
    async findRepairJob() { return repairJob(); },
    async createWarrantyClaim(data) {
      attempts += 1;
      if (attempts === 1) throw { code: 'P2002' };
      return claim(data);
    },
  });
  const service = new WarrantyClaimService(repository);

  const result = await service.openFromRepairJob(actor, 100, { reason: 'Issue' });
  assert.equal(attempts, 2);
  assert.equal(result.status, 'DRAFT');
});

test('converts repeated unique-number collisions to domain conflict', async () => {
  const service = new WarrantyClaimService(transactionRepository({
    async findRepairJob() { return repairJob(); },
    async createWarrantyClaim() { throw { code: 'P2002' }; },
  }));

  await assert.rejects(() => service.openFromRepairJob(actor, 100, { reason: 'Issue' }), {
    code: 'REPAIR_CONFLICT',
    status: 'fail',
  });
});

test('maps get and list claims with branch-safe repository calls', async () => {
  const calls = [];
  const service = new WarrantyClaimService({
    async findWarrantyClaim(branchId, id) {
      calls.push(['get', branchId, id]);
      return claim();
    },
    async listWarrantyClaims(branchId, filters) {
      calls.push(['list', branchId, filters]);
      return [claim({ id: 51 })];
    },
  });

  const detail = await service.getWarrantyClaim(actor, 50);
  const list = await service.listWarrantyClaims(actor, { status: ' submitted ', limit: 0, offset: -1 });

  assert.equal(detail.id, 50);
  assert.equal(list[0].id, 51);
  assert.deepEqual(calls[0], ['get', 7, 50]);
  assert.deepEqual(calls[1], ['list', 7, { status: 'SUBMITTED', stockItemId: null, customerId: null, limit: 50, offset: 0 }]);
});

test('updates claim status, timestamps submission, and writes event metadata', async () => {
  let updateData;
  let eventData;
  const service = new WarrantyClaimService(transactionRepository({
    async findWarrantyClaim() { return claim({ status: 'DRAFT' }); },
    async updateWarrantyClaim(id, data, event) {
      updateData = data;
      eventData = event;
      return claim({ id, ...data });
    },
  }));

  const result = await service.updateStatus(actor, 50, { status: 'submitted', note: ' Sent ' });

  assert.equal(updateData.status, 'SUBMITTED');
  assert.ok(updateData.submittedAt instanceof Date);
  assert.equal(eventData.status, 'SUBMITTED');
  assert.equal(eventData.note, 'Sent');
  assert.equal(eventData.metadata.previousStatus, 'DRAFT');
  assert.equal(result.status, 'SUBMITTED');
});

test('validates replacement stock branch before resolving replacement claim', async () => {
  const service = new WarrantyClaimService(transactionRepository({
    async findWarrantyClaim() { return claim({ status: 'REPLACEMENT_PENDING' }); },
    async findStockItemByIdForIntake() { return { id: 88, branchId: 99 }; },
  }));

  await assert.rejects(() => service.updateStatus(actor, 50, {
    status: 'RESOLVED',
    resolution: 'REPLACED',
    replacementStockItemId: 88,
  }), { code: 'REPAIR_STOCK_ITEM_NOT_FOUND', status: 'fail' });
});