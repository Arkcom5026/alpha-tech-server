const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REPAIR_WORKFLOW_ACTION,
  REPAIR_WORKFLOW_STATUS,
  getAvailableRepairWorkflowActions,
  projectLegacyServiceStatus,
  resolveRepairWorkflowTransition,
} = require('./repairWorkflowPolicy');

test('covers the canonical workflow-command path up to digital handover', () => {
  const path = [
    REPAIR_WORKFLOW_ACTION.ACCEPT_JOB,
    REPAIR_WORKFLOW_ACTION.QUEUE_DIAGNOSIS,
    REPAIR_WORKFLOW_ACTION.START_DIAGNOSIS,
    REPAIR_WORKFLOW_ACTION.COMPLETE_DIAGNOSIS,
    REPAIR_WORKFLOW_ACTION.APPROVE_QUOTATION,
    REPAIR_WORKFLOW_ACTION.START_REPAIR,
    REPAIR_WORKFLOW_ACTION.COMPLETE_REPAIR,
    REPAIR_WORKFLOW_ACTION.PASS_QC,
  ];

  let status = REPAIR_WORKFLOW_STATUS.RECEIVED;
  for (const action of path) {
    status = resolveRepairWorkflowTransition(status, action).targetStatus;
  }

  assert.equal(status, REPAIR_WORKFLOW_STATUS.READY_FOR_DELIVERY);
  assert.deepEqual(getAvailableRepairWorkflowActions(status), []);
  assert.throws(
    () => resolveRepairWorkflowTransition(status, REPAIR_WORKFLOW_ACTION.DELIVER),
    (error) => error.code === 'REPAIR_WORKFLOW_TRANSITION_NOT_ALLOWED'
  );

  const closed = resolveRepairWorkflowTransition(
    REPAIR_WORKFLOW_STATUS.DELIVERED,
    REPAIR_WORKFLOW_ACTION.CLOSE
  );
  assert.equal(closed.targetStatus, REPAIR_WORKFLOW_STATUS.CLOSED);
});

test('requires technician acceptance before inspection or repair can begin', () => {
  const receivedActions = getAvailableRepairWorkflowActions(REPAIR_WORKFLOW_STATUS.RECEIVED);
  assert.deepEqual(
    receivedActions.map((item) => item.action),
    [
      REPAIR_WORKFLOW_ACTION.ACCEPT_JOB,
      REPAIR_WORKFLOW_ACTION.CANCEL,
    ]
  );

  const accepted = resolveRepairWorkflowTransition(
    REPAIR_WORKFLOW_STATUS.RECEIVED,
    REPAIR_WORKFLOW_ACTION.ACCEPT_JOB
  );
  assert.equal(accepted.targetStatus, REPAIR_WORKFLOW_STATUS.ACCEPTED);
  assert.equal(accepted.passportEventType, 'REPAIR_ASSIGNED');

  for (const action of [
    REPAIR_WORKFLOW_ACTION.START_REPAIR,
    REPAIR_WORKFLOW_ACTION.QUEUE_DIAGNOSIS,
    REPAIR_WORKFLOW_ACTION.START_PRE_AGREED_SERVICE,
  ]) {
    assert.throws(
      () => resolveRepairWorkflowTransition(REPAIR_WORKFLOW_STATUS.RECEIVED, action),
      (error) => error.code === 'REPAIR_WORKFLOW_TRANSITION_NOT_ALLOWED'
    );
  }
});

test('keeps inspection and authorized work optional after the technician accepts the job', () => {
  const acceptedActions = getAvailableRepairWorkflowActions(REPAIR_WORKFLOW_STATUS.ACCEPTED);
  assert.deepEqual(
    acceptedActions.map((item) => item.action),
    [
      REPAIR_WORKFLOW_ACTION.START_REPAIR,
      REPAIR_WORKFLOW_ACTION.QUEUE_DIAGNOSIS,
      REPAIR_WORKFLOW_ACTION.START_PRE_AGREED_SERVICE,
      REPAIR_WORKFLOW_ACTION.CANCEL,
    ]
  );

  const directStart = resolveRepairWorkflowTransition(
    REPAIR_WORKFLOW_STATUS.ACCEPTED,
    REPAIR_WORKFLOW_ACTION.START_REPAIR
  );
  assert.equal(directStart.targetStatus, REPAIR_WORKFLOW_STATUS.REPAIRING);
  assert.equal(directStart.passportEventType, 'REPAIR_STATUS_CHANGED');

  const authorizedStart = resolveRepairWorkflowTransition(
    REPAIR_WORKFLOW_STATUS.ACCEPTED,
    REPAIR_WORKFLOW_ACTION.START_PRE_AGREED_SERVICE
  );
  assert.equal(authorizedStart.targetStatus, REPAIR_WORKFLOW_STATUS.REPAIRING);
  assert.equal(authorizedStart.passportEventType, 'REPAIR_STATUS_CHANGED');

  const inspectionPath = resolveRepairWorkflowTransition(
    REPAIR_WORKFLOW_STATUS.ACCEPTED,
    REPAIR_WORKFLOW_ACTION.QUEUE_DIAGNOSIS
  );
  assert.equal(inspectionPath.targetStatus, REPAIR_WORKFLOW_STATUS.WAITING_DIAGNOSIS);
});

test('supports waiting for parts and resuming repair', () => {
  const waiting = resolveRepairWorkflowTransition(
    REPAIR_WORKFLOW_STATUS.REPAIRING,
    REPAIR_WORKFLOW_ACTION.WAIT_FOR_PARTS
  );
  assert.equal(waiting.targetStatus, REPAIR_WORKFLOW_STATUS.WAITING_PARTS);
  assert.equal(waiting.passportEventType, 'REPAIR_STATUS_CHANGED');

  const resumed = resolveRepairWorkflowTransition(
    waiting.targetStatus,
    REPAIR_WORKFLOW_ACTION.RESUME_REPAIR
  );
  assert.equal(resumed.targetStatus, REPAIR_WORKFLOW_STATUS.REPAIRING);
});

test('keeps QC optional while preserving the full QC workflow', () => {
  const actions = getAvailableRepairWorkflowActions(REPAIR_WORKFLOW_STATUS.REPAIRING);
  assert.deepEqual(
    actions.map((item) => item.action),
    [
      REPAIR_WORKFLOW_ACTION.WAIT_FOR_PARTS,
      REPAIR_WORKFLOW_ACTION.COMPLETE_REPAIR_DIRECT,
      REPAIR_WORKFLOW_ACTION.COMPLETE_REPAIR,
      REPAIR_WORKFLOW_ACTION.CANCEL,
    ]
  );

  const directCompletion = resolveRepairWorkflowTransition(
    REPAIR_WORKFLOW_STATUS.REPAIRING,
    REPAIR_WORKFLOW_ACTION.COMPLETE_REPAIR_DIRECT
  );
  assert.equal(directCompletion.targetStatus, REPAIR_WORKFLOW_STATUS.READY_FOR_DELIVERY);
  assert.equal(directCompletion.passportEventType, 'REPAIR_STATUS_CHANGED');

  const qcCompletion = resolveRepairWorkflowTransition(
    REPAIR_WORKFLOW_STATUS.REPAIRING,
    REPAIR_WORKFLOW_ACTION.COMPLETE_REPAIR
  );
  assert.equal(qcCompletion.targetStatus, REPAIR_WORKFLOW_STATUS.WAITING_QC);
  assert.equal(qcCompletion.passportEventType, 'QC_STARTED');
});

test('requires failed QC to return through explicit rework', () => {
  const failed = resolveRepairWorkflowTransition(
    REPAIR_WORKFLOW_STATUS.WAITING_QC,
    REPAIR_WORKFLOW_ACTION.FAIL_QC
  );
  assert.equal(failed.targetStatus, REPAIR_WORKFLOW_STATUS.QC_FAILED);
  assert.equal(failed.passportEventType, 'QC_FAILED');

  assert.throws(
    () => resolveRepairWorkflowTransition(
      failed.targetStatus,
      REPAIR_WORKFLOW_ACTION.PASS_QC
    ),
    (error) => error.code === 'REPAIR_WORKFLOW_TRANSITION_NOT_ALLOWED'
  );

  const rework = resolveRepairWorkflowTransition(
    failed.targetStatus,
    REPAIR_WORKFLOW_ACTION.REWORK_AFTER_QC
  );
  assert.equal(rework.targetStatus, REPAIR_WORKFLOW_STATUS.REPAIRING);
});

test('rejects illegal transitions and exposes available actions', () => {
  assert.throws(
    () => resolveRepairWorkflowTransition(
      REPAIR_WORKFLOW_STATUS.RECEIVED,
      REPAIR_WORKFLOW_ACTION.DELIVER
    ),
    (error) => {
      assert.equal(error.code, 'REPAIR_WORKFLOW_TRANSITION_NOT_ALLOWED');
      assert.equal(error.details.status, REPAIR_WORKFLOW_STATUS.RECEIVED);
      assert.deepEqual(
        error.details.availableActions.map((item) => item.action),
        [
          REPAIR_WORKFLOW_ACTION.ACCEPT_JOB,
          REPAIR_WORKFLOW_ACTION.CANCEL,
        ]
      );
      return true;
    }
  );
});

test('projects authoritative actions including passport event vocabulary', () => {
  const acceptanceActions = getAvailableRepairWorkflowActions(REPAIR_WORKFLOW_STATUS.RECEIVED);
  assert.deepEqual(acceptanceActions[0], {
    action: REPAIR_WORKFLOW_ACTION.ACCEPT_JOB,
    targetStatus: REPAIR_WORKFLOW_STATUS.ACCEPTED,
    passportEventType: 'REPAIR_ASSIGNED',
  });

  const actions = getAvailableRepairWorkflowActions(REPAIR_WORKFLOW_STATUS.WAITING_QC);
  assert.deepEqual(actions, [
    {
      action: REPAIR_WORKFLOW_ACTION.PASS_QC,
      targetStatus: REPAIR_WORKFLOW_STATUS.READY_FOR_DELIVERY,
      passportEventType: 'QC_PASSED',
    },
    {
      action: REPAIR_WORKFLOW_ACTION.FAIL_QC,
      targetStatus: REPAIR_WORKFLOW_STATUS.QC_FAILED,
      passportEventType: 'QC_FAILED',
    },
  ]);
});

test('maps detailed workflow statuses to the current legacy ServiceStatus safely', () => {
  assert.equal(projectLegacyServiceStatus(REPAIR_WORKFLOW_STATUS.RECEIVED), 'RECEIVED');
  assert.equal(projectLegacyServiceStatus(REPAIR_WORKFLOW_STATUS.ACCEPTED), 'RECEIVED');
  assert.equal(projectLegacyServiceStatus(REPAIR_WORKFLOW_STATUS.WAITING_PARTS), 'WAITING_PARTS');
  assert.equal(projectLegacyServiceStatus(REPAIR_WORKFLOW_STATUS.DIAGNOSING), 'IN_PROGRESS');
  assert.equal(projectLegacyServiceStatus(REPAIR_WORKFLOW_STATUS.READY_FOR_DELIVERY), 'IN_PROGRESS');
  assert.equal(projectLegacyServiceStatus(REPAIR_WORKFLOW_STATUS.DELIVERED), 'COMPLETED');
  assert.equal(projectLegacyServiceStatus(REPAIR_WORKFLOW_STATUS.CLOSED), 'COMPLETED');
  assert.equal(projectLegacyServiceStatus(REPAIR_WORKFLOW_STATUS.REJECTED), 'CANCELLED');
  assert.equal(projectLegacyServiceStatus(REPAIR_WORKFLOW_STATUS.CANCELLED), 'CANCELLED');
});

test('rejected quotation is recoverable while only closed/cancelled are terminal', () => {
  const rejected = resolveRepairWorkflowTransition(
    REPAIR_WORKFLOW_STATUS.WAITING_APPROVAL,
    REPAIR_WORKFLOW_ACTION.REJECT_QUOTATION
  );
  assert.equal(rejected.targetStatus, REPAIR_WORKFLOW_STATUS.REJECTED);
  assert.equal(rejected.terminal, false);

  const reopened = resolveRepairWorkflowTransition(
    REPAIR_WORKFLOW_STATUS.REJECTED,
    REPAIR_WORKFLOW_ACTION.REOPEN_AFTER_REJECTION
  );
  assert.equal(reopened.targetStatus, REPAIR_WORKFLOW_STATUS.DIAGNOSING);

  const cancelled = resolveRepairWorkflowTransition(
    REPAIR_WORKFLOW_STATUS.RECEIVED,
    REPAIR_WORKFLOW_ACTION.CANCEL
  );
  assert.equal(cancelled.terminal, true);

  const closed = resolveRepairWorkflowTransition(
    REPAIR_WORKFLOW_STATUS.DELIVERED,
    REPAIR_WORKFLOW_ACTION.CLOSE
  );
  assert.equal(closed.terminal, true);
});
