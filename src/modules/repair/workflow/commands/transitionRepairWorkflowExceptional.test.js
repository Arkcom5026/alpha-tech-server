const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TransitionRepairWorkflowService,
} = require('./transitionRepairWorkflowService');
const {
  resolveRepairWorkflowTransition,
} = require('../policies/repairWorkflowPolicy');

function jobAt(status) {
  return {
    id: 41,
    jobNo: 'RE-3-41',
    branchId: 3,
    deviceId: 55,
    status: status === 'REJECTED' ? 'CANCELLED' : 'IN_PROGRESS',
    technicianNotes: 'บันทึกเดิม',
    deviceIntake: { consent: { customerSignature: 'ลูกค้า', signedAt: new Date() }, photos: [{ category: 'INTAKE_CONDITION' }] },
    device: { id: 55, passportEvents: [{ metadata: { workflowTargetStatus: status } }] },
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
          return { id: 99, ...event };
        },
      });
    },
  };
}

test('rejected quotation can return to diagnosis without becoming terminal', () => {
  const transition = resolveRepairWorkflowTransition('REJECTED', 'REOPEN_AFTER_REJECTION');
  assert.equal(transition.targetStatus, 'DIAGNOSING');
  assert.equal(transition.terminal, false);
});

test('cancel requires a reason before any write', async () => {
  const repo = repositoryFor(jobAt('REPAIRING'));
  const service = new TransitionRepairWorkflowService(repo);

  await assert.rejects(
    service.execute(
      { branchId: 3, employeeId: 7 },
      { repairJobId: 41, action: 'CANCEL', commandKey: 'cancel-1', expectedWorkflowStatus: 'REPAIRING' }
    ),
    (error) => error.code === 'INVALID_REPAIR_WORKFLOW_COMMAND' && error.details.field === 'note'
  );
  assert.equal(repo.calls.update, undefined);
});

test('cancel reason is preserved in job notes and workflow event', async () => {
  const repo = repositoryFor(jobAt('WAITING_PARTS'));
  const service = new TransitionRepairWorkflowService(repo);
  const result = await service.execute(
    { branchId: 3, employeeId: 7 },
    {
      repairJobId: 41,
      action: 'CANCEL',
      commandKey: 'cancel-2',
      expectedWorkflowStatus: 'WAITING_PARTS',
      note: 'ลูกค้าขอยกเลิกและรับเครื่องคืน',
    }
  );

  assert.equal(result.status, 'CANCELLED');
  assert.match(repo.calls.update.extraData.technicianNotes, /ลูกค้าขอยกเลิก/);
  assert.equal(repo.calls.event.metadata.note, 'ลูกค้าขอยกเลิกและรับเครื่องคืน');
});

test('reopen after rejection requires rationale and restores in-progress legacy status', async () => {
  const repo = repositoryFor(jobAt('REJECTED'));
  const service = new TransitionRepairWorkflowService(repo);
  const result = await service.execute(
    { branchId: 3, employeeId: 7 },
    {
      repairJobId: 41,
      action: 'REOPEN_AFTER_REJECTION',
      commandKey: 'reopen-1',
      expectedWorkflowStatus: 'REJECTED',
      note: 'ปรับแนวทางซ่อมเพื่อลดราคา',
    }
  );

  assert.equal(result.status, 'DIAGNOSING');
  assert.equal(repo.calls.update.status, 'IN_PROGRESS');
  assert.match(repo.calls.update.extraData.technicianNotes, /ปรับแนวทางซ่อม/);
});
