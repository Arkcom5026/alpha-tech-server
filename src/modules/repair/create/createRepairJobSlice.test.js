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
    jobNo: data.jobNo || 'RE-3-20260727-TEST0001',
    branchId: data.branchId || 3,
    customerId: data.customerId || 8,
    customer: { name: 'ลูกค้าทดสอบ' },
    stockItemId: data.stockItemId || null,
    stockItem: null,
    deviceId: data.deviceId || null,
    device: data.deviceId ? { id: data.deviceId } : null,
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

test('create repository owns customer, stock, device, technician, repair, intake and passport writes', async () => {
  const calls = {};
  const repository = new CreateRepairJobRepository({
    customerProfile: {
      findFirst(args) { calls.customer = args; return Promise.resolve(null); },
    },
    stockItem: {
      findUnique(args) { calls.stock = args; return Promise.resolve(null); },
    },
    device: {
      findUnique(args) { calls.device = args; return Promise.resolve(null); },
    },
    employeeProfile: {
      findUnique(args) { calls.technician = args; return Promise.resolve(null); },
    },
    repairJob: {
      create(args) { calls.create = args; return Promise.resolve(createdJob(args.data)); },
    },
    deviceIntake: {
      create(args) { calls.intake = args; return Promise.resolve({ id: 71, ...args.data }); },
    },
    devicePassportEvent: {
      create(args) { calls.passport = args; return Promise.resolve({ id: 91, ...args.data }); },
    },
  });

  await repository.findCustomer(3, '8');
  await repository.findStockItemForIntake('12');
  await repository.findDeviceForIntake('55');
  await repository.findTechnician('5');
  await repository.create({ branchId: 3, customerId: 8 });
  await repository.createDeviceIntake({ referenceNo: 'INT-3-TEST' });
  await repository.publishPassportEvent({
    deviceId: 12,
    branchId: 3,
    eventType: 'REPAIR_CREATED',
    sourceType: 'REPAIR_JOB',
    sourceId: '41',
    eventKey: 'repair-job:41:created',
    title: 'เปิดใบงานซ่อม',
  });

  assert.deepEqual(calls.customer.where, { id: 8, branchId: 3 });
  assert.equal(Object.hasOwn(calls.customer.where, 'OR'), false);
  assert.deepEqual(calls.stock.where, { id: 12 });
  assert.ok(calls.stock.include.devices);
  assert.ok(calls.stock.include.repairJobs);
  assert.ok(calls.stock.include.warrantyClaims);
  assert.deepEqual(calls.device.where, { id: 55 });
  assert.ok(calls.device.include.currentOwner);
  assert.ok(calls.device.include.repairJobs);
  assert.ok(calls.device.include.warrantyClaims);
  assert.deepEqual(calls.technician.where, { id: 5 });
  assert.equal(calls.create.data.branchId, 3);
  assert.ok(calls.create.include.customer);
  assert.ok(calls.create.include.device);
  assert.ok(calls.create.include.partsUsed);
  assert.equal(calls.intake.data.referenceNo, 'INT-3-TEST');
  assert.equal(calls.passport.data.eventType, 'REPAIR_CREATED');
});

test('create service validates customer and creates a RECEIVED branch-owned job', async () => {
  let written;
  const service = new CreateRepairJobService({
    transaction(work) {
      return work({
        findCustomer(branchId, customerId) {
          assert.equal(branchId, 3);
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
  assert.equal(written.deviceId, null);
  assert.match(written.jobNo, /^RE-3-/);
  assert.equal(result.id, 41);
  assert.equal(result.estimatedCost, 500);
});

test('create service links stock device, intake authority and REPAIR_CREATED atomically', async () => {
  let written;
  let intakeWritten;
  let published;
  const service = new CreateRepairJobService({
    transaction(work) {
      return work({
        findCustomer: () => Promise.resolve({ id: 8 }),
        findStockItemForIntake: () => Promise.resolve({
          id: 12,
          branchId: 3,
          serialNumber: 'SN-12',
          barcode: 'STOCK-12',
          product: { name: 'Notebook', brand: { name: 'Brand A' } },
          devices: [{ id: 55, brand: 'Brand A', model: 'Notebook', serialNumber: 'SN-12', barcode: 'DEV-55' }],
          repairJobs: [],
          warrantyClaims: [],
          saleItems: [],
        }),
        create(data) {
          written = data;
          return Promise.resolve(createdJob(data));
        },
        createDeviceIntake(data) {
          intakeWritten = data;
          return Promise.resolve({ id: 71, ...data });
        },
        publishPassportEvent(event) {
          published = event;
          return Promise.resolve({ id: 91, ...event });
        },
      });
    },
  });

  await service.execute(
    { branchId: 3, employeeId: 7, role: 'CASHIER' },
    {
      customerId: 8,
      stockItemId: 12,
      deviceModel: 'Notebook',
      reportedSymptoms: 'เปิดไม่ติด',
    }
  );

  assert.equal(written.deviceId, 55);
  assert.equal(intakeWritten.device.connect.id, 55);
  assert.equal(intakeWritten.repairJob.connect.id, 41);
  assert.equal(intakeWritten.receivedBy.connect.id, 7);
  assert.equal(intakeWritten.customerProblem, 'เปิดไม่ติด');
  assert.equal(intakeWritten.status, 'LINKED_TO_REPAIR');
  assert.equal(intakeWritten.snapshot.create.barcode, 'DEV-55');
  assert.equal(published.deviceId, 55);
  assert.equal(published.eventType, 'REPAIR_CREATED');
  assert.equal(published.eventKey, 'repair-job:41:created');
  assert.equal(published.actorEmployeeId, 7);
  assert.equal(published.metadata.deviceIntakeId, 71);
  assert.equal(published.metadata.repairJobId, 41);
});

test('completed registered device starts a new repair job and intake on the same device identity', async () => {
  let written;
  let intakeWritten;
  let published;
  const service = new CreateRepairJobService({
    transaction(work) {
      return work({
        findCustomer: () => Promise.resolve({ id: 8 }),
        findDeviceForIntake(deviceId) {
          assert.equal(deviceId, 77);
          return Promise.resolve({
            id: 77,
            branchId: 3,
            currentOwnerCustomerId: 8,
            stockItemId: null,
            brand: 'Acer',
            model: 'Aspire',
            serialNumber: 'SN-77',
            barcode: 'DEV-77',
            repairJobs: [{ id: 10, jobNo: 'RE-OLD', status: 'COMPLETED' }],
            warrantyClaims: [],
          });
        },
        create(data) {
          written = data;
          return Promise.resolve(createdJob(data));
        },
        createDeviceIntake(data) {
          intakeWritten = data;
          return Promise.resolve({ id: 72, ...data });
        },
        publishPassportEvent(event) {
          published = event;
          return Promise.resolve({ id: 92, ...event });
        },
      });
    },
  });

  const result = await service.execute(
    { branchId: 3, employeeId: 7, role: 'CASHIER' },
    {
      customerId: 8,
      deviceId: 77,
      deviceModel: 'Acer Aspire',
      reportedSymptoms: 'กลับมาซ่อมอาการใหม่',
    }
  );

  assert.equal(written.stockItemId, null);
  assert.equal(written.deviceId, 77);
  assert.equal(written.status, 'RECEIVED');
  assert.equal(result.deviceId, 77);
  assert.equal(intakeWritten.device.connect.id, 77);
  assert.equal(intakeWritten.customer.connect.id, 8);
  assert.equal(intakeWritten.repairJob.connect.id, 41);
  assert.equal(intakeWritten.snapshot.create.serialNumber, 'SN-77');
  assert.equal(intakeWritten.snapshot.create.barcode, 'DEV-77');
  assert.equal(published.deviceId, 77);
  assert.equal(published.metadata.deviceIntakeId, 72);
  assert.equal(published.metadata.deviceId, 77);
  assert.equal(published.metadata.repairJobId, 41);
});

test('registered device with an active repair cannot create a duplicate repair job', async () => {
  const service = new CreateRepairJobService({
    transaction(work) {
      return work({
        findCustomer: () => Promise.resolve({ id: 8 }),
        findDeviceForIntake: () => Promise.resolve({
          id: 77,
          branchId: 3,
          currentOwnerCustomerId: 8,
          repairJobs: [{ id: 11, jobNo: 'RE-ACTIVE', status: 'IN_PROGRESS' }],
          warrantyClaims: [],
        }),
      });
    },
  });

  await assert.rejects(
    () => service.execute(
      { branchId: 3, role: 'CASHIER' },
      {
        customerId: 8,
        deviceId: 77,
        deviceModel: 'Acer Aspire',
        reportedSymptoms: 'อาการใหม่',
      }
    ),
    (error) => {
      assert.equal(error.code, RepairFailureCode.ACTIVE_REPAIR_EXISTS);
      assert.equal(error.details.repairJobId, 11);
      return true;
    }
  );
});

test('registered device must still belong to the selected customer', async () => {
  const service = new CreateRepairJobService({
    transaction(work) {
      return work({
        findCustomer: () => Promise.resolve({ id: 8 }),
        findDeviceForIntake: () => Promise.resolve({
          id: 77,
          branchId: 3,
          currentOwnerCustomerId: 9,
          repairJobs: [{ id: 10, jobNo: 'RE-OLD', status: 'COMPLETED' }],
          warrantyClaims: [],
        }),
      });
    },
  });

  await assert.rejects(
    () => service.execute(
      { branchId: 3, role: 'CASHIER' },
      {
        customerId: 8,
        deviceId: 77,
        deviceModel: 'Acer Aspire',
        reportedSymptoms: 'อาการใหม่',
      }
    ),
    (error) => error.code === RepairFailureCode.DEVICE_CUSTOMER_MISMATCH
  );
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
