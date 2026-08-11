const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TransitionRepairWorkflowService,
} = require('./transitionRepairWorkflowService');

function completeIntake() {
  return {
    consent: {
      customerSignature: 'ลูกค้าทดสอบ',
      signedAt: new Date('2026-07-27T00:00:00Z'),
    },
    photos: [{ category: 'INTAKE_CONDITION' }],
  };
}

function repairJob(overrides = {}) {
  return {
    id: 41,
    jobNo: 'RE-3-41',
    branchId: 3,
    deviceId: 55,
    status: 'RECEIVED',
    device: { id: 55, passportEvents: [] },
    deviceIntake: completeIntake(),
    ...overrides,
  };
}

function repositoryFor(job) {
  const calls = {};
  return {
    calls,
    transaction(work) {
      return work({
        findRepairJob: async () => job,
        updateLegacyStatus: async (id, status, extraData = {}) => {
          calls.update = { id, status, extraData };
          return { ...job, ...extraData, status };
        },
        publishPassportEvent: async (event) => {
          calls.event = event;
          return { id: 91, ...event };
        },
      });
    },
  };
}

test('applies a transition and passport event in one transaction boundary', async () => {
  const repo = repositoryFor(repairJob());
  const service = new TransitionRepairWorkflowService(repo);
  const result = await service.execute(
    { branchId: 3, employeeId: 7 },
    {
      repairJobId: 41,
      action: 'QUEUE_DIAGNOSIS',
      commandKey: 'queue-diagnosis-1',
      expectedWorkflowStatus: 'RECEIVED',
    }
  );

  assert.deepEqual(repo.calls.update, { id: 41, status: 'RECEIVED', extraData: {} });
  assert.equal(repo.calls.event.eventType, 'REPAIR_STATUS_CHANGED');
  assert.equal(repo.calls.event.eventKey, 'repair-workflow:41:queue-diagnosis-1');
  assert.equal(repo.calls.event.metadata.workflowTargetStatus, 'WAITING_DIAGNOSIS');
  assert.equal(result.status, 'WAITING_DIAGNOSIS');
  assert.equal(result.passportEventId, 91);
});

test('allows direct work start from received when intake consent is complete', async () => {
  const repo = repositoryFor(repairJob({
    deviceIntake: {
      consent: {
        customerSignature: 'ลูกค้าทดสอบ',
        signedAt: new Date('2026-07-27T00:00:00Z'),
      },
      photos: [],
    },
  }));
  const service = new TransitionRepairWorkflowService(repo);

  const result = await service.execute(
    { branchId: 3, employeeId: 7 },
    {
      repairJobId: 41,
      action: 'START_REPAIR',
      commandKey: 'start-direct-1',
      expectedWorkflowStatus: 'RECEIVED',
    }
  );

  assert.equal(result.previousStatus, 'RECEIVED');
  assert.equal(result.status, 'REPAIRING');
  assert.equal(result.legacyStatus, 'IN_PROGRESS');
  assert.equal(repo.calls.event.metadata.action, 'START_REPAIR');
  assert.equal(repo.calls.event.metadata.workflowTargetStatus, 'REPAIRING');
});

test('blocks direct work start from received when intake consent is incomplete', async () => {
  const repo = repositoryFor(repairJob({ deviceIntake: null }));
  const service = new TransitionRepairWorkflowService(repo);

  await assert.rejects(
    service.execute(
      { branchId: 3, employeeId: 7 },
      {
        repairJobId: 41,
        action: 'START_REPAIR',
        commandKey: 'start-direct-incomplete',
        expectedWorkflowStatus: 'RECEIVED',
      }
    ),
    (error) => error.code === 'REPAIR_INTAKE_INCOMPLETE'
  );
  assert.equal(repo.calls.update, undefined);
  assert.equal(repo.calls.event, undefined);
});

test('does not add a new intake gate to previously approved jobs', async () => {
  const job = repairJob({
    status: 'IN_PROGRESS',
    deviceIntake: null,
    device: {
      id: 55,
      passportEvents: [{ metadata: { workflowTargetStatus: 'APPROVED' } }],
    },
  });
  const repo = repositoryFor(job);
  const service = new TransitionRepairWorkflowService(repo);

  const result = await service.execute(
    { branchId: 3, employeeId: 7 },
    {
      repairJobId: 41,
      action: 'START_REPAIR',
      commandKey: 'start-approved-legacy',
      expectedWorkflowStatus: 'APPROVED',
    }
  );

  assert.equal(result.status, 'REPAIRING');
  assert.equal(repo.calls.event.metadata.workflowPreviousStatus, 'APPROVED');
});

test('allows diagnosis queue with customer consent even when intake condition photo is absent', async () => {
  const repo = repositoryFor(repairJob({
    deviceIntake: {
      consent: {
        customerSignature: 'ลูกค้าทดสอบ',
        signedAt: new Date('2026-07-27T00:00:00Z'),
      },
      photos: [],
    },
  }));
  const service = new TransitionRepairWorkflowService(repo);

  const result = await service.execute(
    { branchId: 3, employeeId: 7 },
    {
      repairJobId: 41,
      action: 'QUEUE_DIAGNOSIS',
      commandKey: 'queue-without-photo',
      expectedWorkflowStatus: 'RECEIVED',
    }
  );

  assert.equal(result.status, 'WAITING_DIAGNOSIS');
  assert.equal(repo.calls.event.metadata.workflowTargetStatus, 'WAITING_DIAGNOSIS');
});

test('persists structured diagnosis before moving to customer approval', async () => {
  const job = repairJob({
    status: 'IN_PROGRESS',
    device: {
      id: 55,
      passportEvents: [{ metadata: { workflowTargetStatus: 'DIAGNOSING' } }],
    },
  });
  const repo = repositoryFor(job);
  const service = new TransitionRepairWorkflowService(repo);
  const result = await service.execute(
    { branchId: 3, employeeId: 7 },
    {
      repairJobId: 41,
      action: 'COMPLETE_DIAGNOSIS',
      commandKey: 'diagnosis-complete-1',
      expectedWorkflowStatus: 'DIAGNOSING',
      diagnosis: {
        findings: 'เครื่องเปิดไม่ติดและไม่รับไฟ',
        cause: 'ภาคจ่ายไฟเสีย',
        recommendedAction: 'เปลี่ยนชุดภาคจ่ายไฟและทดสอบระบบ',
        estimatedCost: 1800,
        customerNote: 'รออนุมัติก่อนสั่งอะไหล่',
      },
    }
  );

  assert.equal(result.previousStatus, 'DIAGNOSING');
  assert.equal(result.status, 'WAITING_APPROVAL');
  assert.equal(repo.calls.update.status, 'IN_PROGRESS');
  assert.equal(repo.calls.update.extraData.estimatedCost, 1800);
  assert.match(repo.calls.update.extraData.technicianNotes, /ภาคจ่ายไฟเสีย/);
  assert.equal(repo.calls.event.eventType, 'DIAGNOSIS_COMPLETED');
  assert.equal(repo.calls.event.metadata.diagnosis.findings, 'เครื่องเปิดไม่ติดและไม่รับไฟ');
  assert.equal(result.diagnosis.estimatedCost, 1800);
});

test('rejects incomplete diagnosis before any write', () => {
  const job = repairJob({
    status: 'IN_PROGRESS',
    device: {
      id: 55,
      passportEvents: [{ metadata: { workflowTargetStatus: 'DIAGNOSING' } }],
    },
  });
  const repo = repositoryFor(job);
  const service = new TransitionRepairWorkflowService(repo);

  assert.throws(
    () => service.execute(
      { branchId: 3, employeeId: 7 },
      {
        repairJobId: 41,
        action: 'COMPLETE_DIAGNOSIS',
        commandKey: 'diagnosis-invalid',
        diagnosis: { findings: 'พบอาการแล้ว', recommendedAction: '' },
      }
    ),
    (error) =>
      error.code === 'INVALID_REPAIR_WORKFLOW_COMMAND' &&
      error.details.field === 'diagnosis.recommendedAction'
  );
  assert.equal(repo.calls.update, undefined);
  assert.equal(repo.calls.event, undefined);
});

test('rejects stale commands before any write', async () => {
  const job = repairJob({
    device: {
      id: 55,
      passportEvents: [{ metadata: { workflowTargetStatus: 'WAITING_APPROVAL' } }],
    },
  });
  const repo = repositoryFor(job);
  const service = new TransitionRepairWorkflowService(repo);

  await assert.rejects(
    service.execute(
      { branchId: 3, employeeId: 7 },
      {
        repairJobId: 41,
        action: 'APPROVE_QUOTATION',
        commandKey: 'approve-1',
        expectedWorkflowStatus: 'DIAGNOSING',
      }
    ),
    (error) => error.code === 'REPAIR_WORKFLOW_VERSION_CONFLICT'
  );
  assert.equal(repo.calls.update, undefined);
  assert.equal(repo.calls.event, undefined);
});

test('requires branch ownership and a linked device passport', async () => {
  const wrongBranch = new TransitionRepairWorkflowService(repositoryFor(repairJob()));
  await assert.rejects(
    wrongBranch.execute(
      { branchId: 4, employeeId: 7 },
      { repairJobId: 41, action: 'QUEUE_DIAGNOSIS', commandKey: 'x' }
    ),
    (error) => error.code === 'REPAIR_JOB_NOT_FOUND'
  );

  const noDevice = new TransitionRepairWorkflowService(
    repositoryFor(repairJob({ deviceId: null, device: null }))
  );
  await assert.rejects(
    noDevice.execute(
      { branchId: 3, employeeId: 7 },
      { repairJobId: 41, action: 'QUEUE_DIAGNOSIS', commandKey: 'x' }
    ),
    (error) => error.code === 'REPAIR_DEVICE_REQUIRED'
  );
});

test('blocks diagnosis queue when intake consent is incomplete', async () => {
  const repo = repositoryFor(repairJob({ deviceIntake: null }));
  const service = new TransitionRepairWorkflowService(repo);

  await assert.rejects(
    service.execute(
      { branchId: 3, employeeId: 7 },
      { repairJobId: 41, action: 'QUEUE_DIAGNOSIS', commandKey: 'incomplete' }
    ),
    (error) => error.code === 'REPAIR_INTAKE_INCOMPLETE'
  );
  assert.equal(repo.calls.update, undefined);
  assert.equal(repo.calls.event, undefined);
});
