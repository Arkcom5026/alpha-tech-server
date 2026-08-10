const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TransitionRepairWorkflowService,
} = require('./transitionRepairWorkflowService');

function completeIntake() {
  return {
    consent: {
      customerSignature: 'ลูกค้าทดสอบ',
      signedAt: new Date('2026-08-10T00:00:00Z'),
    },
    photos: [],
  };
}

function job(overrides = {}) {
  return {
    id: 88,
    jobNo: 'RE-2-PRE-AGREED',
    branchId: 2,
    deviceId: 77,
    status: 'RECEIVED',
    estimatedCost: 500,
    technicianNotes: null,
    device: { id: 77, passportEvents: [] },
    deviceIntake: completeIntake(),
    preAgreedService: {
      enabled: true,
      agreedScope: 'ลงโปรแกรมและตั้งค่าพื้นฐาน',
      agreedAmount: 500,
      confirmedByName: 'ลูกค้าทดสอบ',
      confirmationNote: 'ตกลงที่หน้าร้าน',
    },
    ...overrides,
  };
}

function repositoryFor(repairJob) {
  const calls = {};
  return {
    calls,
    transaction(work) {
      return work({
        findRepairJob: async () => repairJob,
        updateLegacyStatus: async (id, status, extraData = {}) => {
          calls.update = { id, status, extraData };
          return { ...repairJob, ...extraData, status };
        },
        publishPassportEvent: async (event) => {
          calls.event = event;
          return { id: 501, ...event };
        },
      });
    },
  };
}

test('pre-agreed service skips inspection and quotation approval after intake evidence is complete', async () => {
  const repo = repositoryFor(job());
  const service = new TransitionRepairWorkflowService(repo);

  const result = await service.execute(
    { branchId: 2, employeeId: 35 },
    {
      repairJobId: 88,
      action: 'START_PRE_AGREED_SERVICE',
      commandKey: 'pre-agreed-88',
      expectedWorkflowStatus: 'RECEIVED',
    }
  );

  assert.equal(result.previousStatus, 'RECEIVED');
  assert.equal(result.status, 'APPROVED');
  assert.equal(result.legacyStatus, 'IN_PROGRESS');
  assert.deepEqual(result.preAgreedService, job().preAgreedService);
  assert.equal(repo.calls.event.metadata.workflowTargetStatus, 'APPROVED');
  assert.deepEqual(repo.calls.event.metadata.preAgreedService, job().preAgreedService);
  assert.match(repo.calls.event.description, /ลงโปรแกรม/);
});

test('pre-agreed fast path is blocked without agreement evidence', async () => {
  const repairJob = job({ preAgreedService: null });
  const repo = repositoryFor(repairJob);
  const service = new TransitionRepairWorkflowService(repo);

  await assert.rejects(
    service.execute(
      { branchId: 2, employeeId: 35 },
      {
        repairJobId: 88,
        action: 'START_PRE_AGREED_SERVICE',
        commandKey: 'pre-agreed-missing',
      }
    ),
    (error) => error.code === 'PRE_AGREED_SERVICE_REQUIRED'
  );
  assert.equal(repo.calls.update, undefined);
  assert.equal(repo.calls.event, undefined);
});

test('pre-agreed fast path still requires completed intake consent', async () => {
  const repairJob = job({ deviceIntake: null });
  const repo = repositoryFor(repairJob);
  const service = new TransitionRepairWorkflowService(repo);

  await assert.rejects(
    service.execute(
      { branchId: 2, employeeId: 35 },
      {
        repairJobId: 88,
        action: 'START_PRE_AGREED_SERVICE',
        commandKey: 'pre-agreed-no-consent',
      }
    ),
    (error) => error.code === 'REPAIR_INTAKE_INCOMPLETE'
  );
  assert.equal(repo.calls.update, undefined);
  assert.equal(repo.calls.event, undefined);
});
