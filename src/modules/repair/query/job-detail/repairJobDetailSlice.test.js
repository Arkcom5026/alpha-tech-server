const test = require('node:test');
const assert = require('node:assert/strict');

const {
  RepairJobDetailRepository,
} = require('./repairJobDetailRepository');
const {
  RepairJobDetailService,
} = require('./repairJobDetailService');
const {
  RepairFailureCode,
} = require('../../contracts/repairError');

function jobFixture(overrides = {}) {
  return {
    id: 21,
    jobNo: 'RP-21',
    branchId: 6,
    customerId: 9,
    customer: { companyName: 'Alpha Customer' },
    stockItemId: null,
    stockItem: null,
    deviceId: 31,
    device: { id: 31 },
    deviceModel: 'Desktop',
    reportedSymptoms: 'No display',
    technicianNotes: null,
    status: 'IN_PROGRESS',
    estimatedCost: '1200.50',
    depositPaid: '200',
    technician: null,
    partsUsed: [],
    warrantyClaims: [],
    createdAt: new Date('2026-07-02T00:00:00Z'),
    updatedAt: new Date('2026-07-02T00:00:00Z'),
    ...overrides,
  };
}

test('job detail repository scopes id lookup by branch', async () => {
  let received;
  const repository = new RepairJobDetailRepository({
    repairJob: {
      findFirst(args) {
        received = args;
        return Promise.resolve(null);
      },
    },
    stockMovement: {
      findMany() {
        return Promise.resolve([]);
      },
    },
    $queryRawUnsafe() {
      return Promise.resolve([]);
    },
  });

  await repository.findById('6', '21');

  assert.deepEqual(received.where, { id: 21, branchId: 6 });
  assert.ok(received.include.customer);
  assert.ok(received.include.stockItem);
  assert.ok(received.include.partsUsed);
  assert.ok(received.include.warrantyClaims);
});

test('job detail repository keeps workflow and diagnosis event scopes on the same repair job', async () => {
  const calls = [];
  const repository = new RepairJobDetailRepository({
    repairJob: {
      findFirst() {
        return Promise.resolve(jobFixture());
      },
    },
    stockMovement: {
      findMany() {
        return Promise.resolve([]);
      },
    },
    devicePassportEvent: {
      findFirst(args) {
        calls.push(args);
        return Promise.resolve(null);
      },
      findMany(args) {
        calls.push({ history: args });
        return Promise.resolve([]);
      },
    },
    $queryRawUnsafe() {
      return Promise.resolve([]);
    },
  });

  await repository.findById(6, 21);

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].history.where, {
    deviceId: 31,
    branchId: 6,
    sourceType: 'REPAIR_JOB',
    sourceId: '21',
  });
  assert.deepEqual(calls[1].where, {
    deviceId: 31,
    branchId: 6,
    sourceType: 'REPAIR_JOB',
    sourceId: '21',
    eventType: 'DIAGNOSIS_COMPLETED',
  });
});

test('job detail service validates id before repository access', async () => {
  let called = false;
  const service = new RepairJobDetailService({
    findById() {
      called = true;
      return Promise.resolve(null);
    },
  });

  await assert.rejects(
    () => service.execute({ branchId: 6 }, 'invalid'),
    (error) => {
      assert.equal(error.code, RepairFailureCode.INVALID_INPUT);
      assert.equal(error.statusCode, 400);
      assert.deepEqual(error.details, { field: 'repairJobId' });
      return true;
    }
  );
  assert.equal(called, false);
});

test('job detail keeps completed diagnosis visible after workflow advances', async () => {
  const diagnosis = {
    findings: 'ภาคจ่ายเสีย',
    cause: 'ไฟกระชาก',
    recommendedAction: 'เปลี่ยนภาคจ่าย',
    estimatedCost: 1800,
    customerNote: 'รออนุมัติราคา',
  };
  const service = new RepairJobDetailService({
    findById() {
      return Promise.resolve(
        jobFixture({
          repairWorkflowEvent: {
            id: 90,
            eventType: 'REPAIR_STATUS_CHANGED',
            metadata: { workflowTargetStatus: 'APPROVED' },
          },
          repairDiagnosisEvent: {
            id: 80,
            eventType: 'DIAGNOSIS_COMPLETED',
            metadata: { diagnosis },
          },
        })
      );
    },
  });

  const result = await service.execute({ branchId: 6 }, 21);
  assert.equal(result.workflow.status, 'APPROVED');
  assert.deepEqual(result.workflow.diagnosis, diagnosis);
});

test('job detail service maps result and preserves not-found contract', async () => {
  const successService = new RepairJobDetailService({
    findById(branchId, repairJobId) {
      assert.equal(branchId, 6);
      assert.equal(repairJobId, 21);
      return Promise.resolve(jobFixture({ deviceId: null, device: null }));
    },
  });

  const result = await successService.execute({ branchId: 6 }, '21');
  assert.equal(result.id, 21);
  assert.equal(result.customerName, 'Alpha Customer');
  assert.equal(result.estimatedCost, 1200.5);
  assert.equal(result.workflow.status, 'RECEIVED');

  const notFoundService = new RepairJobDetailService({
    findById() {
      return Promise.resolve(null);
    },
  });

  await assert.rejects(
    () => notFoundService.execute({ branchId: 6 }, 999),
    (error) => {
      assert.equal(error.code, RepairFailureCode.REPAIR_JOB_NOT_FOUND);
      assert.equal(error.statusCode, 404);
      return true;
    }
  );
});
