const test = require('node:test');
const assert = require('node:assert/strict');

const {
  UpdateRepairJobStatusRepository,
} = require('./updateRepairJobStatusRepository');
const {
  UpdateRepairJobStatusService,
} = require('./updateRepairJobStatusService');
const {
  RepairFailureCode,
} = require('../contracts/repairError');

function jobFixture(status = 'RECEIVED') {
  return {
    id: 31,
    jobNo: 'RP-31',
    branchId: 4,
    customerId: 7,
    customer: { name: 'Customer' },
    stockItemId: null,
    stockItem: null,
    deviceModel: 'Notebook',
    reportedSymptoms: 'No power',
    technicianNotes: null,
    status,
    estimatedCost: 0,
    depositPaid: 0,
    technician: null,
    partsUsed: [],
    warrantyClaims: [],
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
  };
}

test('status repository keeps lookup branch-safe and update scoped by job id', async () => {
  let findArgs;
  let updateArgs;
  const repo = new UpdateRepairJobStatusRepository({
    repairJob: {
      findFirst(args) { findArgs = args; return Promise.resolve(null); },
      update(args) { updateArgs = args; return Promise.resolve(jobFixture('DIAGNOSING')); },
    },
  });

  await repo.findJob('4', '31');
  await repo.updateJob('31', { status: 'DIAGNOSING' });

  assert.deepEqual(findArgs.where, { id: 31, branchId: 4 });
  assert.deepEqual(updateArgs.where, { id: 31 });
  assert.deepEqual(updateArgs.data, { status: 'DIAGNOSING' });
});

test('status service validates job id before transaction access', async () => {
  let called = false;
  const service = new UpdateRepairJobStatusService({
    transaction() { called = true; },
  });

  await assert.rejects(
    () => service.execute({ branchId: 4 }, 'bad', { status: 'DIAGNOSING' }),
    (error) => error.code === RepairFailureCode.INVALID_INPUT
  );
  assert.equal(called, false);
});

test('status service applies transition and maps updated job', async () => {
  let updateData;
  const txRepo = {
    findJob(branchId, id) {
      assert.equal(branchId, 4);
      assert.equal(id, 31);
      return Promise.resolve(jobFixture('RECEIVED'));
    },
    findTechnician(id) {
      assert.equal(id, 9);
      return Promise.resolve({ id: 9, branchId: 4, active: true });
    },
    updateJob(id, data) {
      assert.equal(id, 31);
      updateData = data;
      return Promise.resolve({
        ...jobFixture('DIAGNOSING'),
        technicianNotes: 'ตรวจสอบแล้ว',
        technician: { id: 9, name: 'Tech', phone: null },
      });
    },
  };
  const service = new UpdateRepairJobStatusService({
    transaction(work) { return work(txRepo); },
  });

  const result = await service.execute(
    { branchId: 4 },
    31,
    { status: 'diagnosing', technicianId: 9, technicianNotes: ' ตรวจสอบแล้ว ' }
  );

  assert.deepEqual(updateData, {
    status: 'DIAGNOSING',
    technicianNotes: 'ตรวจสอบแล้ว',
    technicianId: 9,
  });
  assert.equal(result.status, 'DIAGNOSING');
  assert.equal(result.technician.id, 9);
});

test('status service preserves not-found and technician scope failures', async () => {
  const notFound = new UpdateRepairJobStatusService({
    transaction(work) {
      return work({ findJob: () => Promise.resolve(null) });
    },
  });
  await assert.rejects(
    () => notFound.execute({ branchId: 4 }, 99, { status: 'DIAGNOSING' }),
    (error) => error.code === RepairFailureCode.REPAIR_JOB_NOT_FOUND
  );

  const invalidTechnician = new UpdateRepairJobStatusService({
    transaction(work) {
      return work({
        findJob: () => Promise.resolve(jobFixture('RECEIVED')),
        findTechnician: () => Promise.resolve({ id: 9, branchId: 5, active: true }),
      });
    },
  });
  await assert.rejects(
    () => invalidTechnician.execute(
      { branchId: 4 },
      31,
      { status: 'DIAGNOSING', technicianId: 9 }
    ),
    (error) => error.code === RepairFailureCode.TECHNICIAN_NOT_FOUND
  );
});
