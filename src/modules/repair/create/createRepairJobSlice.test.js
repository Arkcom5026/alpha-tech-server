const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CreateRepairJobRepository,
} = require('./createRepairJobRepository');
const {
  CreateRepairJobService,
} = require('./createRepairJobService');
const { RepairFailureCode } = require('../contracts/repairError');

function createdJob(data = {}) {
  return {
    id: 41,
    jobNo: data.jobNo || 'RP-010101-0001',
    branchId: data.branchId || 3,
    customerId: data.customerId || 8,
    customer: { name: 'ลูกค้าทดสอบ' },
    stockItemId: data.stockItemId || null,
    stockItem: null,
    deviceModel: data.deviceModel || 'Notebook',
    reportedSymptoms: data.reportedSymptoms || 'เปิดไม่ติด',
    technicianNotes: data.technicianNotes || null,
    status: data.status || 'RECEIVED',
    estimatedCost: data.estimatedCost ?? 500,
    depositPaid: data.depositPaid ?? 100,
    technician: null,
    partsUsed: [],
    warrantyClaims: [],
    createdAt: new Date('2026-07-27T00:00:00Z'),
    updatedAt: new Date('2026-07-27T00:00:00Z'),
  };
}

test('create repository binds transaction work to transaction client', async () => {
  const tx = {};
  let receivedRepo;
  const repository = new CreateRepairJobRepository({
    $transaction(work) {
      return work(tx);
    },
  });

  await repository.transaction((repo) => {
    receivedRepo = repo;
    return Promise.resolve();
  });

  assert.equal(receivedRepo.prisma, tx);
});

test('create repository owns customer, stock, technician and repair writes', async () => {
  const calls = {};
  const repository = new CreateRepairJobRepository({
    customerProfile: {
      findUnique(args) { calls.customer = args; return Promise.resolve(null); },
    },
    stockItem: {
      findUnique(args) { calls.stock = args; return Promise.resolve(null); },
    },
    employeeProfile: {
      findUnique(args) { calls.technician = args; return Promise.resolve(null); },
    },
    repairJob: {
      create(args) { calls.create = args; return Promise.resolve(createdJob(args.data)); },
    },
  });

  await repository.findCustomer('8');
  await repository.findStockItemForIntake('12');
  await repository.findTechnician('5');
  await repository.create({ branchId: 3, customerId: 8 });

  assert.deepEqual(calls.customer.where, { id: 8 });
  assert.deepEqual(calls.stock.where, { id: 12 });
  assert.ok(calls.stock.include.repairJobs);
  assert.ok(calls.stock.include.warrantyClaims);
  assert.deepEqual(calls.technician.where, { id: 5 });
  assert.equal(calls.create.data.branchId, 3);
  assert.ok(calls.create.include.customer);
  assert.ok(calls.create.include.partsUsed);
});

test('create service validates customer and creates a RECEIVED branch-owned job', async () => {
  let written;
  const service = new CreateRepairJobService({
    transaction(work) {
      return work({
        findCustomer(customerId) {
          assert.equal(customerId, 8);
          return Promise.resolve({ id: 8 });
        },
        create(data) {
          written = data;
          return Promise.resolve(createdJob(data));
        },
      });
    },
  });

  const result = await service.execute(
    { branchId: 3, role: 'CASHIER' },
    {
      customerId: '8',
      deviceModel: ' Notebook ',
      reportedSymptoms: ' เปิดไม่ติด ',
      estimatedCost: '500',
      depositPaid: '100',
    }
  );

  assert.equal(written.branchId, 3);
  assert.equal(written.customerId, 8);
  assert.equal(written.status, 'RECEIVED');
  assert.equal(written.deviceModel, 'Notebook');
  assert.match(written.jobNo, /^RP-/);
  assert.equal(result.id, 41);
  assert.equal(result.estimatedCost, 500);
});

test('create service preserves customer-not-found and unique-conflict contracts', async () => {
  const missingCustomerService = new CreateRepairJobService({
    transaction(work) {
      return work({ findCustomer: () => Promise.resolve(null) });
    },
  });

  await assert.rejects(
    () => missingCustomerService.execute(
      { branchId: 3, role: 'CASHIER' },
      { customerId: 8, deviceModel: 'Notebook', reportedSymptoms: 'เปิดไม่ติด' }
    ),
    (error) => error.code === RepairFailureCode.CUSTOMER_NOT_FOUND
  );

  const uniqueError = Object.assign(new Error('duplicate'), { code: 'P2002' });
  let attempts = 0;
  const conflictService = new CreateRepairJobService({
    transaction() {
      attempts += 1;
      return Promise.reject(uniqueError);
    },
  });

  await assert.rejects(
    () => conflictService.execute(
      { branchId: 3, role: 'CASHIER' },
      { customerId: 8, deviceModel: 'Notebook', reportedSymptoms: 'เปิดไม่ติด' }
    ),
    (error) => {
      assert.equal(error.code, RepairFailureCode.CONFLICT);
      assert.equal(error.statusCode, 409);
      return true;
    }
  );
  assert.equal(attempts, 2);
});
