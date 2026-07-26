const test = require('node:test');
const assert = require('node:assert/strict');
const { RepairService } = require('./repairService');

const actor = { branchId: 7, employeeId: 9, role: 'MANAGER' };

function mappedJob(overrides = {}) {
  return {
    id: 100,
    jobNo: 'RE-7-20260727-TEST',
    branchId: 7,
    customerId: 20,
    customer: { name: 'Customer' },
    stockItemId: null,
    stockItem: null,
    deviceModel: 'Notebook',
    reportedSymptoms: 'No power',
    technicianNotes: null,
    status: 'RECEIVED',
    estimatedCost: 500,
    depositPaid: 100,
    technician: null,
    partsUsed: [],
    warrantyClaims: [],
    createdAt: new Date('2026-07-27T00:00:00.000Z'),
    updatedAt: new Date('2026-07-27T00:00:00.000Z'),
    ...overrides,
  };
}

function transactionRepository(methods = {}) {
  const repo = { ...methods };
  return {
    ...repo,
    async transaction(callback) {
      return callback(repo);
    },
  };
}

test('creates a received repair job with normalized payload and actor branch', async () => {
  let createdData;
  const repository = transactionRepository({
    async findCustomer(id) {
      assert.equal(id, 20);
      return { id };
    },
    async createRepairJob(data) {
      createdData = data;
      return mappedJob(data);
    },
  });
  const service = new RepairService(repository);

  const result = await service.createRepairJob(actor, {
    customerId: '20',
    deviceModel: ' Notebook ',
    reportedSymptoms: ' No power ',
    depositPaid: '100',
    estimatedCost: '500',
  });

  assert.equal(createdData.branchId, 7);
  assert.equal(createdData.customerId, 20);
  assert.equal(createdData.status, 'RECEIVED');
  assert.match(createdData.jobNo, /^RE-7-\d{8}-/);
  assert.equal(result.status, 'RECEIVED');
  assert.equal(result.estimatedCost, 500);
});

test('rejects creation when customer does not exist', async () => {
  const service = new RepairService(transactionRepository({
    async findCustomer() { return null; },
  }));

  await assert.rejects(() => service.createRepairJob(actor, {
    customerId: 20,
    deviceModel: 'Notebook',
    reportedSymptoms: 'No power',
  }), { code: 'REPAIR_CUSTOMER_NOT_FOUND', status: 'fail' });
});

test('requires manager role for customer mismatch override', async () => {
  const stockItem = {
    id: 1,
    branchId: 7,
    repairJobs: [],
    warrantyClaims: [],
    saleItems: [{ sale: { customerId: 99, soldAt: '2026-07-01T00:00:00.000Z' } }],
  };
  const repository = transactionRepository({
    async findCustomer() { return { id: 20 }; },
    async findStockItemByIdForIntake() { return stockItem; },
  });
  const service = new RepairService(repository);

  await assert.rejects(() => service.createRepairJob(
    { ...actor, role: 'STAFF' },
    {
      customerId: 20,
      stockItemId: 1,
      deviceModel: 'Notebook',
      reportedSymptoms: 'No power',
      allowCustomerOverride: true,
    }
  ), { code: 'REPAIR_STOCK_ITEM_CUSTOMER_MISMATCH', status: 'fail' });
});

test('maps get and list results and keeps branch scope', async () => {
  const calls = [];
  const repository = {
    async findRepairJob(branchId, id) {
      calls.push(['get', branchId, id]);
      return mappedJob();
    },
    async listRepairJobs(branchId, filters) {
      calls.push(['list', branchId, filters]);
      return [mappedJob({ id: 101 })];
    },
  };
  const service = new RepairService(repository);

  const detail = await service.getRepairJob(actor, 100);
  const list = await service.listRepairJobs(actor, { status: ' received ', limit: 500, offset: -2 });

  assert.equal(detail.id, 100);
  assert.equal(list[0].id, 101);
  assert.deepEqual(calls[0], ['get', 7, 100]);
  assert.deepEqual(calls[1], ['list', 7, { status: 'RECEIVED', stockItemId: null, customerId: null, limit: 100, offset: 0 }]);
});

test('updates valid status and rejects missing job', async () => {
  let updateData;
  const service = new RepairService(transactionRepository({
    async findRepairJob() { return mappedJob(); },
    async updateRepairJob(id, data) {
      updateData = data;
      return mappedJob({ id, ...data });
    },
  }));

  const updated = await service.updateJobStatus(actor, 100, {
    status: 'in_progress',
    technicianNotes: ' Diagnosing ',
  });
  assert.deepEqual(updateData, { status: 'IN_PROGRESS', technicianNotes: 'Diagnosing' });
  assert.equal(updated.status, 'IN_PROGRESS');

  const missing = new RepairService(transactionRepository({
    async findRepairJob() { return null; },
  }));
  await assert.rejects(() => missing.updateJobStatus(actor, 404, { status: 'IN_PROGRESS' }), {
    code: 'REPAIR_JOB_NOT_FOUND',
    status: 'fail',
  });
});

test('adds parts atomically using branch price precedence and records stock movement', async () => {
  const calls = [];
  const repository = transactionRepository({
    async findRepairJob() { return mappedJob({ status: 'IN_PROGRESS' }); },
    async findProduct() { return { id: 30, active: true }; },
    async findStockBalance() { return { quantity: 5, avgCost: 80 }; },
    async findBranchPrice() { return { priceTechnician: 120, priceRetail: 150, costPrice: 90 }; },
    async createRepairPart(data) {
      calls.push(['part', data]);
      return { id: 1, ...data, product: { name: 'RAM' } };
    },
    async decrementStockBalance(...args) { calls.push(['decrement', ...args]); },
    async createStockMovement(data) { calls.push(['movement', data]); },
  });
  const service = new RepairService(repository);

  const result = await service.addPartsToRepairJob(actor, 100, { productId: 30, qtyUsed: 2 });

  assert.equal(result.unitPrice, 120);
  assert.deepEqual(calls[1], ['decrement', 7, 30, 2]);
  assert.equal(calls[2][1].qty, -2);
  assert.equal(calls[2][1].refType, 'REPAIR_JOB_PART_USAGE');
  assert.equal(calls[2][1].performedByEmployeeId, 9);
});

test('rejects insufficient part stock before any write', async () => {
  let writes = 0;
  const service = new RepairService(transactionRepository({
    async findRepairJob() { return mappedJob({ status: 'IN_PROGRESS' }); },
    async findProduct() { return { id: 30, active: true }; },
    async findStockBalance() { return { quantity: 1 }; },
    async createRepairPart() { writes += 1; },
  }));

  await assert.rejects(() => service.addPartsToRepairJob(actor, 100, { productId: 30, qtyUsed: 2 }),
    (error) => {
      assert.equal(error.code, 'REPAIR_PART_STOCK_INSUFFICIENT');
      assert.deepEqual(error.details, { available: 1, requested: 2 });
      return true;
    });
  assert.equal(writes, 0);
});