const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RepairEstimateApprovalService,
} = require('../repairEstimateApprovalService');

function pendingApproval(overrides = {}) {
  return {
    id: 81,
    repairJobId: 41,
    estimateAmount: 1800,
    depositAmount: 300,
    balanceAmount: 1500,
    status: 'PENDING',
    requestNote: null,
    customerNote: null,
    confirmedByName: null,
    requestedAt: new Date('2026-08-10T08:00:00Z'),
    expiresAt: new Date('2026-08-24T08:00:00Z'),
    decidedAt: null,
    ...overrides,
  };
}

function trackingRepo() {
  const calls = {};
  return {
    calls,
    async findValidByTokenHash() {
      return { id: 19, repairJobId: 41 };
    },
    async touch(id) {
      calls.touched = id;
    },
  };
}

function repositoryFor({ workflowStatus = 'WAITING_APPROVAL', approval } = {}) {
  const calls = {};
  const row = approval || pendingApproval();
  const repo = {
    calls,
    async findRepairJobForStaff() {
      return {
        id: 41,
        jobNo: 'RE-3-41',
        branchId: 3,
        deviceId: 55,
        status: 'IN_PROGRESS',
        estimatedCost: 1800,
        depositPaid: 300,
      };
    },
    async findLatestWorkflowEvent() {
      return { metadata: { workflowTargetStatus: workflowStatus } };
    },
    transaction(work) {
      return work(repo);
    },
    async supersedePending() {},
    async create(data) {
      calls.created = data;
      return row;
    },
    async findById() {
      return row;
    },
    async findRepairJobWorkflowContext() {
      return {
        id: 41,
        jobNo: 'RE-3-41',
        branchId: 3,
        deviceId: 55,
        status: 'IN_PROGRESS',
      };
    },
    async decide(data) {
      calls.decide = data;
      return {
        ...row,
        status: data.decision,
        confirmedByName: data.confirmedByName,
        customerNote: data.customerNote,
        decidedAt: new Date('2026-08-10T09:00:00Z'),
      };
    },
    async updateRepairStatus(id, status) {
      calls.status = { id, status };
      return { id, status };
    },
    async publishWorkflowEvent(event) {
      calls.event = event;
      return { id: 901, ...event };
    },
  };
  return repo;
}

test('publishing estimate is allowed only after diagnosis reaches waiting approval', async () => {
  const allowedRepo = repositoryFor();
  const service = new RepairEstimateApprovalService(allowedRepo, trackingRepo());
  const result = await service.publish(
    { branchId: 3, employeeId: 7 },
    41,
    { expiryDays: 14, requestNote: 'รวมค่าแรงแล้ว' }
  );

  assert.equal(result.workflowStatus, 'WAITING_APPROVAL');
  assert.equal(allowedRepo.calls.created.repairJobId, 41);
  assert.equal(result.contractVersion, 'repair-estimate-approval.v2');

  const blockedRepo = repositoryFor({ workflowStatus: 'DIAGNOSING' });
  const blockedService = new RepairEstimateApprovalService(blockedRepo, trackingRepo());
  await assert.rejects(
    blockedService.publish({ branchId: 3, employeeId: 7 }, 41, {}),
    (error) => error.code === 'REPAIR_NOT_WAITING_APPROVAL'
  );
});

test('customer approval advances WAITING_APPROVAL to APPROVED atomically', async () => {
  const repo = repositoryFor();
  const tracking = trackingRepo();
  const service = new RepairEstimateApprovalService(repo, tracking);

  const result = await service.decideByTrackingToken('x'.repeat(64), {
    approvalId: 81,
    decision: 'APPROVED',
    confirmedByName: 'สมชาย ลูกค้า',
    customerNote: 'อนุมัติให้ซ่อมได้',
  });

  assert.equal(repo.calls.decide.decision, 'APPROVED');
  assert.deepEqual(repo.calls.status, { id: 41, status: 'IN_PROGRESS' });
  assert.equal(repo.calls.event.metadata.workflowPreviousStatus, 'WAITING_APPROVAL');
  assert.equal(repo.calls.event.metadata.workflowTargetStatus, 'APPROVED');
  assert.equal(repo.calls.event.metadata.estimateApprovalId, 81);
  assert.equal(repo.calls.event.customerVisible, true);
  assert.equal(result.status, 'APPROVED');
  assert.equal(result.workflowStatus, 'APPROVED');
  assert.equal(result.passportEventId, 901);
  assert.equal(tracking.calls.touched, 19);
});

test('customer rejection advances workflow to REJECTED and projects legacy cancellation', async () => {
  const repo = repositoryFor();
  const service = new RepairEstimateApprovalService(repo, trackingRepo());

  const result = await service.decideByTrackingToken('y'.repeat(64), {
    approvalId: 81,
    decision: 'REJECTED',
    confirmedByName: 'ลูกค้าทดสอบ',
    customerNote: 'ยังไม่ซ่อม',
  });

  assert.deepEqual(repo.calls.status, { id: 41, status: 'CANCELLED' });
  assert.equal(repo.calls.event.metadata.workflowTargetStatus, 'REJECTED');
  assert.equal(result.workflowStatus, 'REJECTED');
});

test('decision fails closed when repair workflow already moved away from waiting approval', async () => {
  const repo = repositoryFor({ workflowStatus: 'REPAIRING' });
  const service = new RepairEstimateApprovalService(repo, trackingRepo());

  await assert.rejects(
    service.decideByTrackingToken('z'.repeat(64), {
      approvalId: 81,
      decision: 'APPROVED',
      confirmedByName: 'ลูกค้าทดสอบ',
    }),
    (error) => error.code === 'REPAIR_APPROVAL_WORKFLOW_CONFLICT'
  );
  assert.equal(repo.calls.decide, undefined);
  assert.equal(repo.calls.status, undefined);
  assert.equal(repo.calls.event, undefined);
});
