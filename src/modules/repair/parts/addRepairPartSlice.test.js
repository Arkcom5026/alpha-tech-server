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

test('add part repository keeps job, workflow and stock operations branch-safe', async () => {
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
    stockBalance: {
      findUnique(args) {
        calls.balance = args;
        return Promise.resolve(null);
      },
      update(args) {
        calls.decrement = args;
        return Promise.resolve(null);
      },
    },
  });

  await repository.findRepairJob('7', '31');
  await repository.findLatestWorkflowEvent('7', '31', '88');
  await repository.findStockBalance('7', '12');
  await repository.decrementStockBalance('7', '12', 2);

  assert.deepEqual(calls.job.where, { id: 31, branchId: 7 });
  assert.deepEqual(calls.workflow.where, {
    deviceId: 88,
    branchId: 7,
    sourceType: 'REPAIR_JOB',
    sourceId: '31',
  });
  assert.deepEqual(calls.balance.where.productId_branchId, {
    productId: 12,
    branchId: 7,
  });
  assert.deepEqual(calls.decrement.where.productId_branchId, {
    productId: 12,
    branchId: 7,
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

test('add part service writes part, stock decrement and movement atomically while repairing', async () => {
  const calls = [];
  const txRepo = {
    findRepairJob(branchId, repairJobId) {
      assert.equal(branchId, 7);
      assert.equal(repairJobId, 31);
      return Promise.resolve({ id: 31, jobNo: 'RP-31', status: 'IN_PROGRESS', deviceId: 88 });
    },
    findLatestWorkflowEvent(branchId, repairJobId, deviceId) {
      assert.equal(branchId, 7);
      assert.equal(repairJobId, 31);
      assert.equal(deviceId, 88);
      return Promise.resolve({ metadata: { workflowTargetStatus: 'REPAIRING' } });
    },
    findProduct(productId) {
      assert.equal(productId, 12);
      return Promise.resolve({ id: 12, active: true });
    },
    findStockBalance(branchId, productId) {
      assert.equal(branchId, 7);
      assert.equal(productId, 12);
      return Promise.resolve({ quantity: 5, avgCost: '120' });
    },
    findBranchPrice() {
      return Promise.resolve({ priceTechnician: '180' });
    },
    createRepairPart(data) {
      calls.push(['part', data]);
      return Promise.resolve({
        id: 8,
        ...data,
        unitPrice: '180',
        product: { name: 'Ink Cartridge' },
      });
    },
    decrementStockBalance(branchId, productId, qtyUsed) {
      calls.push(['decrement', { branchId, productId, qtyUsed }]);
      return Promise.resolve();
    },
    createStockMovement(data) {
      calls.push(['movement', data]);
      return Promise.resolve();
    },
  };
  const service = new AddRepairPartService({
    transaction(work) {
      return work(txRepo);
    },
  });

  const result = await service.execute(
    { branchId: 7, employeeId: 4 },
    '31',
    { productId: '12', qtyUsed: '2' }
  );

  assert.equal(result.productName, 'Ink Cartridge');
  assert.equal(result.unitPrice, 180);
  assert.deepEqual(calls[0][1], {
    repairJobId: 31,
    productId: 12,
    qtyUsed: 2,
    unitPrice: 180,
  });
  assert.deepEqual(calls[1][1], { branchId: 7, productId: 12, qtyUsed: 2 });
  assert.equal(calls[2][1].qty, -2);
  assert.equal(calls[2][1].refType, 'REPAIR_JOB_PART_USAGE');
  assert.equal(calls[2][1].performedByEmployeeId, 4);
});

test('add part service blocks usage before repair starts and while waiting for parts', async () => {
  for (const workflowStatus of ['APPROVED', 'WAITING_PARTS']) {
    const service = new AddRepairPartService({
      transaction(work) {
        return work({
          findRepairJob() {
            return Promise.resolve({ id: 31, status: 'IN_PROGRESS', deviceId: 88 });
          },
          findLatestWorkflowEvent() {
            return Promise.resolve({ metadata: { workflowTargetStatus: workflowStatus } });
          },
        });
      },
    });

    await assert.rejects(
      () => service.execute({ branchId: 7 }, 31, { productId: 12, qtyUsed: 1 }),
      (error) => {
        assert.equal(error.code, RepairFailureCode.CONFLICT);
        assert.equal(error.statusCode, 409);
        assert.deepEqual(error.details, {
          workflowStatus,
          requiredWorkflowStatus: 'REPAIRING',
        });
        return true;
      }
    );
  }
});

test('add part service preserves terminal and insufficient stock failures', async () => {
  const terminalService = new AddRepairPartService({
    transaction(work) {
      return work({
        findRepairJob() {
          return Promise.resolve({ id: 31, status: 'COMPLETED' });
        },
      });
    },
  });

  await assert.rejects(
    () => terminalService.execute({ branchId: 7 }, 31, { productId: 12, qtyUsed: 1 }),
    (error) => {
      assert.equal(error.code, RepairFailureCode.REPAIR_JOB_TERMINAL);
      assert.equal(error.statusCode, 409);
      return true;
    }
  );

  const stockService = new AddRepairPartService({
    transaction(work) {
      return work({
        findRepairJob() {
          return Promise.resolve({ id: 31, jobNo: 'RP-31', status: 'IN_PROGRESS', deviceId: 88 });
        },
        findLatestWorkflowEvent() {
          return Promise.resolve({ metadata: { workflowTargetStatus: 'REPAIRING' } });
        },
        findProduct() {
          return Promise.resolve({ id: 12, active: true });
        },
        findStockBalance() {
          return Promise.resolve({ quantity: 1 });
        },
      });
    },
  });

  await assert.rejects(
    () => stockService.execute({ branchId: 7 }, 31, { productId: 12, qtyUsed: 2 }),
    (error) => {
      assert.equal(error.code, RepairFailureCode.PART_STOCK_INSUFFICIENT);
      assert.deepEqual(error.details, { available: 1, requested: 2 });
      return true;
    }
  );
});
