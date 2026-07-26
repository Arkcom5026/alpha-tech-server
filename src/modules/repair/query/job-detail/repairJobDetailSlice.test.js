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

function jobFixture() {
  return {
    id: 21,
    jobNo: 'RP-21',
    branchId: 6,
    customerId: 9,
    customer: { companyName: 'Alpha Customer' },
    stockItemId: null,
    stockItem: null,
    deviceModel: 'Desktop',
    reportedSymptoms: 'No display',
    technicianNotes: null,
    status: 'DIAGNOSING',
    estimatedCost: '1200.50',
    depositPaid: '200',
    technician: null,
    partsUsed: [],
    warrantyClaims: [],
    createdAt: new Date('2026-07-02T00:00:00Z'),
    updatedAt: new Date('2026-07-02T00:00:00Z'),
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
  });

  await repository.findById('6', '21');

  assert.deepEqual(received.where, { id: 21, branchId: 6 });
  assert.ok(received.include.customer);
  assert.ok(received.include.stockItem);
  assert.ok(received.include.partsUsed);
  assert.ok(received.include.warrantyClaims);
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

test('job detail service maps result and preserves not-found contract', async () => {
  const successService = new RepairJobDetailService({
    findById(branchId, repairJobId) {
      assert.equal(branchId, 6);
      assert.equal(repairJobId, 21);
      return Promise.resolve(jobFixture());
    },
  });

  const result = await successService.execute({ branchId: 6 }, '21');
  assert.equal(result.id, 21);
  assert.equal(result.customerName, 'Alpha Customer');
  assert.equal(result.estimatedCost, 1200.5);

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
