const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CreateExternalDeviceIntakeService,
} = require('./createExternalDeviceIntakeService');
const { RepairFailureCode } = require('../contracts/repairError');

function repairJob(data) {
  return {
    id: 41,
    ...data,
    customer: { id: data.customerId, name: 'ลูกค้าทดสอบ' },
    device: { id: data.deviceId },
    stockItem: null,
    technician: null,
    partsUsed: [],
    warrantyClaims: [],
    createdAt: new Date('2026-07-27T00:00:00Z'),
    updatedAt: new Date('2026-07-27T00:00:00Z'),
  };
}

function repositoryFixture(writes = []) {
  return {
    transaction(work) {
      return work({
        findCustomer: () => Promise.resolve({ id: 8 }),
        findDeviceByIdentity: () => Promise.resolve(null),
        createDevice(data) {
          writes.push(['device', data]);
          return Promise.resolve({ id: 55, ...data });
        },
        createRepairJob(data) {
          writes.push(['repair', data]);
          return Promise.resolve(repairJob(data));
        },
        createDeviceIntake(data) {
          writes.push(['intake', data]);
          return Promise.resolve({ id: 71, referenceNo: data.referenceNo });
        },
        createOwnership(data) {
          writes.push(['ownership', data]);
          return Promise.resolve({ id: 81, ...data });
        },
        publishPassportEvent(data) {
          writes.push(['event', data]);
          return Promise.resolve({ id: 91, ...data });
        },
      });
    },
  };
}

test('external intake creates device, ownership, intake, repair and passport events atomically', async () => {
  const writes = [];
  const service = new CreateExternalDeviceIntakeService(repositoryFixture(writes));

  const result = await service.execute(
    { branchId: 3, employeeId: 7, role: 'CASHIER' },
    {
      customerId: 8,
      device: {
        category: 'NOTEBOOK',
        brand: 'ASUS',
        model: 'VivoBook',
        serialNumber: 'SN-001',
      },
      customerProblem: 'เปิดไม่ติด',
      accessories: [{ accessoryType: 'POWER_ADAPTER', quantity: 1 }],
    }
  );

  assert.deepEqual(
    writes.map(([type]) => type),
    ['device', 'repair', 'intake', 'ownership', 'event', 'event']
  );
  assert.equal(writes[0][1].stockItemId, null);
  assert.equal(writes[0][1].currentOwnerCustomerId, 8);
  assert.equal(writes[1][1].deviceId, 55);
  assert.equal(writes[2][1].repairJob.connect.id, 41);
  assert.equal(writes[3][1].sourceType, 'DEVICE_INTAKE');
  assert.equal(writes[4][1].eventType, 'REGISTERED');
  assert.equal(writes[5][1].eventType, 'REPAIR_CREATED');
  assert.equal(writes[5][1].metadata.workflowTargetStatus, 'RECEIVED');
  assert.equal(result.repairJob.id, 41);
  assert.equal(result.workflowStatus, 'RECEIVED');
  assert.deepEqual(result.availableActions, [
    { action: 'ACCEPT_JOB', targetStatus: 'ACCEPTED' },
  ]);
});

test('external intake preserves repair authorization without requiring an agreed price', async () => {
  const writes = [];
  const service = new CreateExternalDeviceIntakeService(repositoryFixture(writes));

  const result = await service.execute(
    { branchId: 3, employeeId: 7, role: 'CASHIER' },
    {
      customerId: 8,
      customerName: 'ลูกค้าทดสอบ',
      device: {
        category: 'NOTEBOOK',
        brand: 'ASUS',
        model: 'VivoBook',
      },
      customerProblem: 'ลง Windows และโปรแกรมพื้นฐาน',
      estimatedCost: 0,
      preAgreedService: {
        enabled: true,
        authorizationMode: 'REPAIR_AUTHORIZED',
        confirmedByName: 'ลูกค้าทดสอบ',
        confirmationNote: 'อนุมัติให้ซ่อมโดยไม่ต้องเสนอราคาก่อน',
      },
    }
  );

  const repairWrite = writes.find(([type]) => type === 'repair')[1];
  const createdEvent = writes.filter(([type]) => type === 'event')[1][1];

  assert.equal(repairWrite.estimatedCost, 0);
  assert.equal(createdEvent.metadata.preAgreedService.agreedAmount, null);
  assert.equal(createdEvent.metadata.preAgreedService.authorizationMode, 'REPAIR_AUTHORIZED');
  assert.match(createdEvent.metadata.preAgreedService.agreedScope, /อนุมัติ/);
  assert.deepEqual(
    result.availableActions.map((item) => item.action),
    ['ACCEPT_JOB']
  );
  assert.equal(result.preAgreedService.confirmedByName, 'ลูกค้าทดสอบ');
});

test('external intake rejects duplicate serial or IMEI before writing', async () => {
  const service = new CreateExternalDeviceIntakeService({
    transaction(work) {
      return work({
        findCustomer: () => Promise.resolve({ id: 8 }),
        findDeviceByIdentity: () => Promise.resolve({ id: 55 }),
      });
    },
  });

  await assert.rejects(
    () =>
      service.execute(
        { branchId: 3, employeeId: 7, role: 'CASHIER' },
        {
          customerId: 8,
          device: {
            category: 'NOTEBOOK',
            model: 'VivoBook',
            serialNumber: 'SN-001',
          },
          customerProblem: 'เปิดไม่ติด',
        }
      ),
    (error) => {
      assert.equal(error.code, RepairFailureCode.CONFLICT);
      assert.equal(error.statusCode, 409);
      assert.equal(error.details.deviceId, 55);
      return true;
    }
  );
});
