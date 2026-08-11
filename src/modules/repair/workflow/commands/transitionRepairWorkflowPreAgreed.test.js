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
    jobNo: 'RE-2-AUTHORIZED',
    branchId: 2,
    deviceId: 77,
    status: 'RECEIVED',
    estimatedCost: 0,
    technicianNotes: null,
    device: {
      id: 77,
      passportEvents: [{ metadata: { workflowTargetStatus: 'ACCEPTED' } }],
    },
    deviceIntake: completeIntake(),
    preAgreedService: {
      enabled: true,
      authorizationMode: 'REPAIR_AUTHORIZED',
      agreedScope: 'ลูกค้าอนุมัติให้ดำเนินการซ่อมตามอาการที่แจ้ง',
      agreedAmount: null,
      confirmedByName: 'ลูกค้าทดสอบ',
      confirmationNote: 'อนุมัติที่หน้าร้าน ไม่ต้องเสนอราคาก่อนซ่อม',
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

test('repair authorization starts repair after technician acceptance without requiring an agreed amount', async () => {
  const repo = repositoryFor(job());
  const service = new TransitionRepairWorkflowService(repo);

  const result = await service.execute(
    { branchId: 2, employeeId: 35 },
    {
      repairJobId: 88,
      action: 'START_PRE_AGREED_SERVICE',
      commandKey: 'authorized-88',
      expectedWorkflowStatus: 'ACCEPTED',
    }
  );

  assert.equal(result.previousStatus, 'ACCEPTED');
  assert.equal(result.status, 'REPAIRING');
  assert.equal(result.legacyStatus, 'IN_PROGRESS');
  assert.equal(result.preAgreedService.agreedAmount, null);
  assert.equal(result.preAgreedService.authorizationMode, 'REPAIR_AUTHORIZED');
  assert.equal(repo.calls.event.metadata.workflowTargetStatus, 'REPAIRING');
  assert.deepEqual(repo.calls.event.metadata.preAgreedService, job().preAgreedService);
  assert.match(repo.calls.event.description, /อนุมัติ/);
});

test('authorized repair cannot start before technician acceptance', async () => {
  const repairJob = job({
    device: { id: 77, passportEvents: [] },
  });
  const repo = repositoryFor(repairJob);
  const service = new TransitionRepairWorkflowService(repo);

  await assert.rejects(
    service.execute(
      { branchId: 2, employeeId: 35 },
      {
        repairJobId: 88,
        action: 'START_PRE_AGREED_SERVICE',
        commandKey: 'authorized-before-accept',
        expectedWorkflowStatus: 'RECEIVED',
      }
    ),
    (error) => error.code === 'REPAIR_WORKFLOW_TRANSITION_NOT_ALLOWED'
  );
  assert.equal(repo.calls.update, undefined);
  assert.equal(repo.calls.event, undefined);
});

test('authorized repair is blocked without customer authorization evidence', async () => {
  const repairJob = job({ preAgreedService: null });
  const repo = repositoryFor(repairJob);
  const service = new TransitionRepairWorkflowService(repo);

  await assert.rejects(
    service.execute(
      { branchId: 2, employeeId: 35 },
      {
        repairJobId: 88,
        action: 'START_PRE_AGREED_SERVICE',
        commandKey: 'authorized-missing',
        expectedWorkflowStatus: 'ACCEPTED',
      }
    ),
    (error) => error.code === 'PRE_AGREED_SERVICE_REQUIRED'
  );
  assert.equal(repo.calls.update, undefined);
  assert.equal(repo.calls.event, undefined);
});

test('authorized repair still requires completed intake consent', async () => {
  const repairJob = job({ deviceIntake: null });
  const repo = repositoryFor(repairJob);
  const service = new TransitionRepairWorkflowService(repo);

  await assert.rejects(
    service.execute(
      { branchId: 2, employeeId: 35 },
      {
        repairJobId: 88,
        action: 'START_PRE_AGREED_SERVICE',
        commandKey: 'authorized-no-consent',
        expectedWorkflowStatus: 'ACCEPTED',
      }
    ),
    (error) => error.code === 'REPAIR_INTAKE_INCOMPLETE'
  );
  assert.equal(repo.calls.update, undefined);
  assert.equal(repo.calls.event, undefined);
});
