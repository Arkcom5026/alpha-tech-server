const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TransitionRepairWorkflowService,
} = require('../src/modules/repair/workflow/commands/transitionRepairWorkflowService');

function completeIntake() {
  return {
    consent: {
      customerSignature: 'ลูกค้าทดสอบ',
      signedAt: new Date('2026-08-14T00:00:00Z'),
    },
    photos: [],
  };
}

function repairJob(overrides = {}) {
  return {
    id: 81,
    jobNo: 'RE-3-81',
    branchId: 3,
    customerId: 19,
    deviceId: null,
    device: null,
    deviceModel: 'เครื่องใช้ไฟฟ้าทดสอบ',
    reportedSymptoms: 'เปิดไม่ติด',
    status: 'RECEIVED',
    technicianId: null,
    technicianNotes: null,
    deviceIntake: null,
    repairWorkflowEvent: null,
    warrantyClaims: [],
    ...overrides,
  };
}

function repositoryFor(job, { activeSubcontract = null } = {}) {
  const calls = {
    workflowEvents: [],
    passportEvents: [],
  };
  return {
    calls,
    transaction(work) {
      return work({
        findRepairJob: async () => job,
        findActiveSubcontract: async () => activeSubcontract,
        updateLegacyStatus: async (id, status, extraData = {}) => {
          calls.update = { id, status, extraData };
          return { ...job, ...extraData, status };
        },
        publishWorkflowEvent: async (event) => {
          calls.workflowEvents.push(event);
          return { id: 501, ...event };
        },
        publishPassportEvent: async (event) => {
          calls.passportEvents.push(event);
          return { id: 601, ...event };
        },
      });
    },
  };
}

test('RECEIVED repair without Device Passport can be accepted', async () => {
  const repo = repositoryFor(repairJob());
  const service = new TransitionRepairWorkflowService(repo);

  const result = await service.execute(
    { branchId: 3, employeeId: 7 },
    {
      repairJobId: 81,
      action: 'ACCEPT_JOB',
      commandKey: 'accept-no-passport',
      expectedWorkflowStatus: 'RECEIVED',
    }
  );

  assert.equal(result.status, 'ACCEPTED');
  assert.equal(result.passportEventId, null);
  assert.equal(result.workflowEventId, 501);
  assert.equal(repo.calls.workflowEvents.length, 1);
  assert.equal(repo.calls.workflowEvents[0].targetStatus, 'ACCEPTED');
  assert.equal(repo.calls.passportEvents.length, 0);
  assert.deepEqual(repo.calls.update.extraData, { technicianId: 7 });
});

test('RECEIVED repair without Device Passport can be cancelled with reason', async () => {
  const repo = repositoryFor(repairJob());
  const service = new TransitionRepairWorkflowService(repo);

  const result = await service.execute(
    { branchId: 3, employeeId: 7 },
    {
      repairJobId: 81,
      action: 'CANCEL',
      commandKey: 'cancel-no-passport',
      expectedWorkflowStatus: 'RECEIVED',
      note: 'ลูกค้ายกเลิกการซ่อม',
    }
  );

  assert.equal(result.status, 'CANCELLED');
  assert.equal(result.passportEventId, null);
  assert.equal(repo.calls.workflowEvents[0].targetStatus, 'CANCELLED');
  assert.match(repo.calls.update.extraData.technicianNotes, /ลูกค้ายกเลิกการซ่อม/);
});

test('repair-owned workflow status drives later commands without Device Passport', async () => {
  const accepted = repairJob({
    technicianId: 7,
    repairWorkflowEvent: {
      id: 500,
      targetStatus: 'ACCEPTED',
      metadata: { workflowTargetStatus: 'ACCEPTED' },
    },
  });
  const repo = repositoryFor(accepted);
  const service = new TransitionRepairWorkflowService(repo);

  const result = await service.execute(
    { branchId: 3, employeeId: 7 },
    {
      repairJobId: 81,
      action: 'START_REPAIR',
      commandKey: 'start-no-passport',
      expectedWorkflowStatus: 'ACCEPTED',
    }
  );

  assert.equal(result.status, 'REPAIRING');
  assert.equal(result.legacyStatus, 'IN_PROGRESS');
  assert.equal(repo.calls.workflowEvents[0].previousStatus, 'ACCEPTED');
  assert.equal(repo.calls.workflowEvents[0].targetStatus, 'REPAIRING');
  assert.equal(repo.calls.passportEvents.length, 0);
});

test('linked Device Passport path still receives trace projection', async () => {
  const linked = repairJob({
    deviceId: 55,
    device: { id: 55, passportEvents: [] },
    deviceIntake: completeIntake(),
  });
  const repo = repositoryFor(linked);
  const service = new TransitionRepairWorkflowService(repo);

  const result = await service.execute(
    { branchId: 3, employeeId: 7 },
    {
      repairJobId: 81,
      action: 'ACCEPT_JOB',
      commandKey: 'accept-linked',
      expectedWorkflowStatus: 'RECEIVED',
    }
  );

  assert.equal(result.status, 'ACCEPTED');
  assert.equal(result.workflowEventId, 501);
  assert.equal(result.passportEventId, 601);
  assert.equal(repo.calls.workflowEvents.length, 1);
  assert.equal(repo.calls.passportEvents.length, 1);
  assert.equal(repo.calls.passportEvents[0].metadata.workflowTargetStatus, 'ACCEPTED');
});

test('branch isolation remains fail-closed without Device Passport', async () => {
  const repo = repositoryFor(repairJob());
  const service = new TransitionRepairWorkflowService(repo);

  await assert.rejects(
    service.execute(
      { branchId: 4, employeeId: 7 },
      {
        repairJobId: 81,
        action: 'ACCEPT_JOB',
        commandKey: 'wrong-branch',
      }
    ),
    (error) => error.code === 'REPAIR_JOB_NOT_FOUND'
  );
  assert.equal(repo.calls.workflowEvents.length, 0);
  assert.equal(repo.calls.passportEvents.length, 0);
});
