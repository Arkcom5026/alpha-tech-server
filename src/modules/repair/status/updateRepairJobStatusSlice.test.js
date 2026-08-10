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

function jobFixture(status = 'RECEIVED', overrides = {}) {
  return {
    id: 31,
    jobNo: 'RE-4-20260727-TEST0031',
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
    deviceIntake: {
      consent: { id: 1 },
      photos: [{ id: 1, category: 'INTAKE_CONDITION' }],
    },
    delivery: null,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
    ...overrides,
  };
}

test('status repository keeps lookup branch-safe and loads intake authority', async () => {
  let findArgs;
  let updateArgs;
  const repo = new UpdateRepairJobStatusRepository({
    repairJob: {
      findFirst(args) { findArgs = args; return Promise.resolve(null); },
      update(args) { updateArgs = args; return Promise.resolve(jobFixture('IN_PROGRESS')); },
    },
  });

  await repo.findJob('4', '31');
  await repo.updateJob('31', { status: 'IN_PROGRESS' });

  assert.deepEqual(findArgs.where, { id: 31, branchId: 4 });
  assert.ok(findArgs.include.deviceIntake);
  assert.equal(findArgs.include.deviceIntake.include.consent, true);
  assert.equal(findArgs.include.deviceIntake.include.photos, true);
  assert.deepEqual(updateArgs.where, { id: 31 });
  assert.deepEqual(updateArgs.data, { status: 'IN_PROGRESS' });
});

test('status service validates job id before transaction access', async () => {
  let called = false;
  const service = new UpdateRepairJobStatusService({
    transaction() { called = true; },
  });

  await assert.rejects(
    () => service.execute({ branchId: 4 }, 'bad', { status: 'IN_PROGRESS' }),
    (error) => error.code === RepairFailureCode.INVALID_INPUT
  );
  assert.equal(called, false);
});

test('status service rejects active work when intake evidence is missing', async () => {
  let updated = false;
  const service = new UpdateRepairJobStatusService({
    transaction(work) {
      return work({
        findJob: () => Promise.resolve(jobFixture('RECEIVED', { deviceIntake: null })),
        updateJob: () => { updated = true; },
      });
    },
  });

  await assert.rejects(
    () => service.execute({ branchId: 4 }, 31, { status: 'IN_PROGRESS' }),
    (error) =>
      error.code === RepairFailureCode.INTAKE_EVIDENCE_INCOMPLETE &&
      error.statusCode === 409
  );
  assert.equal(updated, false);
});

test('status service requires consent but allows missing condition photo', async () => {
  const missingConsent = new UpdateRepairJobStatusService({
    transaction(work) {
      return work({
        findJob: () => Promise.resolve(jobFixture('RECEIVED', {
          deviceIntake: { consent: null, photos: [{ category: 'INTAKE_CONDITION' }] },
        })),
      });
    },
  });

  await assert.rejects(
    () => missingConsent.execute({ branchId: 4 }, 31, { status: 'IN_PROGRESS' }),
    (error) => error.code === RepairFailureCode.INTAKE_EVIDENCE_INCOMPLETE
  );

  let updated = false;
  const consentOnly = new UpdateRepairJobStatusService({
    transaction(work) {
      return work({
        findJob: () => Promise.resolve(jobFixture('RECEIVED', {
          deviceIntake: { consent: { id: 1 }, photos: [] },
        })),
        updateJob: () => {
          updated = true;
          return Promise.resolve(jobFixture('IN_PROGRESS', {
            deviceIntake: { consent: { id: 1 }, photos: [] },
          }));
        },
        createTimelineEvent: () => Promise.resolve({ id: 1 }),
      });
    },
  });

  const result = await consentOnly.execute({ branchId: 4, employeeId: 12 }, 31, { status: 'IN_PROGRESS' });
  assert.equal(updated, true);
  assert.equal(result.status, 'IN_PROGRESS');
});

test('status service applies transition and records timeline event atomically', async () => {
  let updateData;
  let timelineEvent;
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
        ...jobFixture('IN_PROGRESS'),
        technicianNotes: 'ตรวจสอบแล้ว',
        technician: { id: 9, name: 'Tech', phone: null },
      });
    },
    createTimelineEvent(event) {
      timelineEvent = event;
      return Promise.resolve({ id: 1, repairJobId: event.repairJobId });
    },
  };
  const service = new UpdateRepairJobStatusService({
    transaction(work) { return work(txRepo); },
  });

  const result = await service.execute(
    { branchId: 4, employeeId: 12 },
    31,
    { status: 'in_progress', technicianId: 9, technicianNotes: ' ตรวจสอบแล้ว ' }
  );

  assert.deepEqual(updateData, {
    status: 'IN_PROGRESS',
    technicianNotes: 'ตรวจสอบแล้ว',
    technicianId: 9,
  });
  assert.deepEqual(timelineEvent, {
    repairJobId: 31,
    eventType: 'STATUS_CHANGED',
    fromStatus: 'RECEIVED',
    toStatus: 'IN_PROGRESS',
    customerVisible: true,
    customerTitle: 'กำลังตรวจสอบหรือดำเนินการ',
    customerMessage: 'ช่างกำลังตรวจสอบหรือซ่อมอุปกรณ์',
    internalNote: 'ตรวจสอบแล้ว',
    performedByEmployeeId: 12,
    metadata: {
      customerCode: 'IN_PROGRESS',
      customerStage: 2,
    },
  });
  assert.equal(result.status, 'IN_PROGRESS');
  assert.equal(result.technician.id, 9);
});

test('status service preserves not-found and technician scope failures', async () => {
  const notFound = new UpdateRepairJobStatusService({
    transaction(work) {
      return work({ findJob: () => Promise.resolve(null) });
    },
  });
  await assert.rejects(
    () => notFound.execute({ branchId: 4 }, 99, { status: 'IN_PROGRESS' }),
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
      { status: 'IN_PROGRESS', technicianId: 9 }
    ),
    (error) => error.code === RepairFailureCode.TECHNICIAN_NOT_FOUND
  );
});
