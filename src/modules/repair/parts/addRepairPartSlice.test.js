const test = require('node:test');
const assert = require('node:assert/strict');

const {
  AddRepairPartRepository,
} = require('./addRepairPartRepository');
const {
  AddRepairPartService,
} = require('./addRepairPartService');
const {
  RepairFailureCode,
} = require('../contracts/repairError');

test('add part repository keeps job, workflow, stock item and balance operations branch-safe', async () => {
  const calls = {};
  const repository = new AddRepairPartRepository({
    repairJob: {
      findFirst(args) {
        calls.job = args;
        return Promise.resolve(null);
      },
    },
    devicePassportEvent: {
      findFirst(args) {
        calls.workflow = args;
        return Promise.resolve(null);
      },
    },
    stockItem: {
      findFirst(args) {
        calls.stockItem = args;
        return Promise.resolve(null);
      },
      updateMany(args) {
        calls.consume = args;
        return Promise.resolve({ count: 1 });
      },
    },
    stockBalance: {
      findUnique(args) {
        calls.balance = args;
        return Promise.resolve(null);
      },
      updateMany(args) {
        calls.decrement = args;
        return Promise.resolve({ count: 1 });
      },
    },
  });

  await repository.findRepairJob('7', '31');
  await repository.findLatestWorkflowEvent('7', '31', '88');
  await repository.findStockItem('7', '12', '90');
  await repository.consumeStockItem('7', '12', '90');
  await repository.findStockBalance('7', '12');
  await repository.decrementStockBalance('7', '12', 2);

  assert.deepEqual(calls.job.where, { id: 31, branchId: 7 });
  assert.deepEqual(calls.workflow.where, {
    deviceId: 88,
    branchId: 7,
    sourceType: 'REPAIR_JOB',
    sourceId: '31',
  });
  assert.deepEqual(calls.stockItem.where, { id: 90, branchId: 7, productId: 12 });
  assert.equal(calls.consume.where.status, 'IN_STOCK');
  assert.equal(calls.consume.data.status, 'USED');
  assert.deepEqual(calls.balance.where.productId_branchId, { productId: 12, branchId: 7 });
  assert.deepEqual(calls.decrement.where, {
    productId: 12,
    branchId: 7,
    quantity: { gte: 2 },
  });
  assert.deepEqual(calls.decrement.data, { quantity: { decrement: 2 } });
});

test('add part service rejects invalid job id before transaction', async () => {
  let called = false;
  const service = new AddRepairPartService({
    transaction() {
      called = true;
    },
  });

  await assert.rejects(
    () => service.execute({ branchId: 7 }, 'bad', { productId: 12, qtyUsed: 1 }),
    (error) => {
      assert.equal(error.code, RepairFailureCode.INVALID_INPUT);
      assert.deepEqual(error.details, { field: 'repairJobId' });
      return true;
    }
  );
  assert.equal(called, false);
});

test('quantity part writes repair part, balance decrement and inventory movement atomically', async () => {
  const calls = [];
  const txRepo = {
    findRepairJob() {
      return Promise.resolve({ id: 31, jobNo: 'RP-31', status: 'IN_PROGRESS', deviceId: 88, warrantyClaims: [] });
    },
    findLatestWorkflowEvent() {
      return Promise.resolve({ metadata: { workflowTargetStatus: 'REPAIRING' } });
    },
    findProduct() {
      return Promise.resolve({ id: 12, active: true, branchId: 7, trackSerialNumber: false, inventoryBehavior: 'TRACKED' });
    },
    findStockBalance() {
      return Promise.resolve({ quantity: 5, avgCost: '120' });
    },
    findBranchPrice() {
      return Promise.resolve({ priceTechnician: '180' });
    },
    decrementStockBalance(branchId, productId, qtyUsed) {
      calls.push(['decrement', { branchId, productId, qtyUsed }]);
      return Promise.resolve({ count: 1 });
    },
    createRepairPart(data) {
      calls.push(['part', data]);
      return Promise.resolve({ id: 8, ...data, unitPrice: '180', product: { name: 'Ink Cartridge' } });
    },
    createStockMovement(data) {
      calls.push(['movement', data]);
      return Promise.resolve();
    },
  };
  const service = new AddRepairPartService({ transaction: (work) => work(txRepo) });

  const result = await service.execute(
    { branchId: 7, employeeId: 4 },
    31,
    { productId: 12, qtyUsed: 2 }
  );

  assert.equal(result.serialized, false);
  assert.equal(result.productName, 'Ink Cartridge');
  assert.deepEqual(calls[0][1], { branchId: 7, productId: 12, qtyUsed: 2 });
  assert.equal(calls[2][1].qty, -2);
  assert.equal(calls[2][1].stockItemId, null);
  assert.equal(calls[2][1].refType, 'REPAIR_JOB_PART_USAGE');
});

test('serialized part requires one IN_STOCK StockItem and consumes it as USED', async () => {
  const calls = [];
  const txRepo = {
    findRepairJob() {
      return Promise.resolve({ id: 31, jobNo: 'RP-31', status: 'IN_PROGRESS', deviceId: 88, warrantyClaims: [] });
    },
    findLatestWorkflowEvent() {
      return Promise.resolve({ metadata: { workflowTargetStatus: 'REPAIRING' } });
    },
    findProduct() {
      return Promise.resolve({ id: 12, active: true, branchId: 7, trackSerialNumber: true, inventoryBehavior: 'TRACKED' });
    },
    findStockItem() {
      return Promise.resolve({ id: 90, productId: 12, branchId: 7, barcode: 'BC90', serialNumber: 'SN90', status: 'IN_STOCK' });
    },
    findStockBalance() {
      return Promise.resolve({ quantity: 1, avgCost: '250' });
    },
    findBranchPrice() {
      return Promise.resolve({ priceTechnician: '300' });
    },
    consumeStockItem(branchId, productId, stockItemId) {
      calls.push(['consume', { branchId, productId, stockItemId }]);
      return Promise.resolve({ count: 1 });
    },
    decrementStockBalance(branchId, productId, qtyUsed) {
      calls.push(['decrement', { branchId, productId, qtyUsed }]);
      return Promise.resolve({ count: 1 });
    },
    createRepairPart(data) {
      calls.push(['part', data]);
      return Promise.resolve({ id: 9, ...data, product: { name: 'SSD 1TB' } });
    },
    createStockMovement(data) {
      calls.push(['movement', data]);
      return Promise.resolve();
    },
  };
  const service = new AddRepairPartService({ transaction: (work) => work(txRepo) });

  const result = await service.execute(
    { branchId: 7, employeeId: 4 },
    31,
    { productId: 12, stockItemId: 90, qtyUsed: 1 }
  );

  assert.equal(result.serialized, true);
  assert.equal(result.stockItem.serialNumber, 'SN90');
  assert.equal(result.stockItem.status, 'USED');
  assert.deepEqual(calls[0], ['consume', { branchId: 7, productId: 12, stockItemId: 90 }]);
  assert.equal(calls[3][1].stockItemId, 90);
  assert.equal(calls[3][1].previousStockStatus, 'IN_STOCK');
  assert.equal(calls[3][1].resultingStockStatus, 'USED');
});

test('serialized part rejects missing stock item, quantity > 1 and non-ready stock', async () => {
  const baseRepo = (overrides = {}) => ({
    findRepairJob: () => Promise.resolve({ id: 31, status: 'IN_PROGRESS', deviceId: 88, warrantyClaims: [] }),
    findLatestWorkflowEvent: () => Promise.resolve({ metadata: { workflowTargetStatus: 'REPAIRING' } }),
    findProduct: () => Promise.resolve({ id: 12, active: true, branchId: 7, trackSerialNumber: true, inventoryBehavior: 'TRACKED' }),
    ...overrides,
  });

  for (const payload of [
    { productId: 12, qtyUsed: 1 },
    { productId: 12, stockItemId: 90, qtyUsed: 2 },
  ]) {
    const service = new AddRepairPartService({ transaction: (work) => work(baseRepo()) });
    await assert.rejects(
      () => service.execute({ branchId: 7, employeeId: 4 }, 31, payload),
      (error) => error.code === RepairFailureCode.INVALID_INPUT
    );
  }

  const service = new AddRepairPartService({
    transaction: (work) => work(baseRepo({
      findStockItem: () => Promise.resolve({ id: 90, status: 'SOLD' }),
    })),
  });
  await assert.rejects(
    () => service.execute({ branchId: 7, employeeId: 4 }, 31, { productId: 12, stockItemId: 90, qtyUsed: 1 }),
    (error) => error.code === RepairFailureCode.CONFLICT
  );
});

test('add part service blocks usage before repair starts, during claim hold and with insufficient stock', async () => {
  for (const workflowStatus of ['APPROVED', 'WAITING_PARTS']) {
    const service = new AddRepairPartService({
      transaction(work) {
        return work({
          findRepairJob: () => Promise.resolve({ id: 31, status: 'IN_PROGRESS', deviceId: 88, warrantyClaims: [] }),
          findLatestWorkflowEvent: () => Promise.resolve({ metadata: { workflowTargetStatus: workflowStatus } }),
        });
      },
    });
    await assert.rejects(
      () => service.execute({ branchId: 7 }, 31, { productId: 12, qtyUsed: 1 }),
      (error) => error.code === RepairFailureCode.CONFLICT
    );
  }

  const claimService = new AddRepairPartService({
    transaction: (work) => work({
      findRepairJob: () => Promise.resolve({
        id: 31,
        status: 'IN_PROGRESS',
        deviceId: 88,
        warrantyClaims: [{ id: 5, claimNo: 'WC-5', status: 'SUBMITTED' }],
      }),
    }),
  });
  await assert.rejects(
    () => claimService.execute({ branchId: 7 }, 31, { productId: 12, qtyUsed: 1 }),
    (error) => error.code === RepairFailureCode.CONFLICT
  );

  const stockService = new AddRepairPartService({
    transaction: (work) => work({
      findRepairJob: () => Promise.resolve({ id: 31, status: 'IN_PROGRESS', deviceId: 88, warrantyClaims: [] }),
      findLatestWorkflowEvent: () => Promise.resolve({ metadata: { workflowTargetStatus: 'REPAIRING' } }),
      findProduct: () => Promise.resolve({ id: 12, active: true, branchId: 7, trackSerialNumber: false, inventoryBehavior: 'TRACKED' }),
      findStockBalance: () => Promise.resolve({ quantity: 1 }),
    }),
  });
  await assert.rejects(
    () => stockService.execute({ branchId: 7 }, 31, { productId: 12, qtyUsed: 2 }),
    (error) => error.code === RepairFailureCode.PART_STOCK_INSUFFICIENT
  );
});
