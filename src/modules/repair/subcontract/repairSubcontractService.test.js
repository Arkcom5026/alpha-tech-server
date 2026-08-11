const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RepairSubcontractService,
  assertCanSend,
} = require('./repairSubcontractService');

function job(overrides = {}) {
  return {
    id: 41,
    jobNo: 'RE-2-41',
    branchId: 2,
    deviceId: 90,
    status: 'IN_PROGRESS',
    estimatedCost: 3000,
    warrantyClaims: [],
    deviceIntake: {
      consent: {
        allowOutsourceRepair: true,
        customerSignature: 'ลูกค้าทดสอบ',
        signedAt: new Date('2026-08-11T00:00:00Z'),
      },
    },
    ...overrides,
  };
}

function repositoryFor(options = {}) {
  const calls = {};
  const repairJob = options.job || job();
  const workflowStatus = options.workflowStatus || 'APPROVED';
  const active = options.active || null;
  const repo = {
    calls,
    transaction(work) { return work(repo); },
    async findRepairJob() { return repairJob; },
    async findLatestWorkflowEvent() {
      return { metadata: { workflowTargetStatus: workflowStatus } };
    },
    async findActive() { return active; },
    async findExpensePayee() { return { id: 19, name: 'External Repair A', phone: '0800000000', taxId: null }; },
    async listRelatedExpenses() { return []; },
    async create(data) {
      calls.create = data;
      return {
        id: 7,
        status: 'SENT',
        sentAt: new Date('2026-08-11T12:00:00Z'),
        createdAt: new Date('2026-08-11T12:00:00Z'),
        updatedAt: new Date('2026-08-11T12:00:00Z'),
        ...data,
      };
    },
    async createTimelineEvent(data) { calls.timeline = data; return { id: 8 }; },
    async list() { return []; },
    async findById() { return options.current || null; },
    async updateDetails() { return null; },
    async requestReturn() { return null; },
    async receiveReturn() { return null; },
  };
  return repo;
}

test('uses the existing rough repair estimate as a flexible send snapshot', async () => {
  const repo = repositoryFor();
  const service = new RepairSubcontractService(repo);
  const result = await service.send(
    { branchId: 2, employeeId: 35 },
    41,
    {
      expensePayeeId: 19,
      providerName: 'ร้านซ่อมภายนอก A',
      workScope: 'ตรวจและซ่อมเมนบอร์ด',
      customerApprovalNote: 'ถ้าเกินประมาณการให้โทรถามก่อน',
    }
  );

  assert.equal(repo.calls.create.customerEstimateAmount, 3000);
  assert.equal(repo.calls.create.customerApprovalNote, 'ถ้าเกินประมาณการให้โทรถามก่อน');
  assert.equal(repo.calls.timeline.eventType, 'REPAIR_SUBCONTRACT_SENT');
  assert.equal(result.status, 'SENT');
  assert.equal(result.active, true);
});

test('allows a flexible customer agreement note without forcing a numeric ceiling', async () => {
  const repo = repositoryFor({
    workflowStatus: 'REPAIRING',
    job: job({ estimatedCost: 0 }),
  });
  const service = new RepairSubcontractService(repo);

  await service.send(
    { branchId: 2, employeeId: 35 },
    41,
    {
      expensePayeeId: 19,
      providerName: 'ร้านซ่อมภายนอก B',
      workScope: 'ตรวจอาการเชิงลึก',
      customerApprovalNote: 'ลูกค้าตกลงให้ส่งตรวจ ถ้าราคาสูงให้ติดต่ออีกครั้ง',
    }
  );

  assert.equal(repo.calls.create.customerEstimateAmount, null);
  assert.match(repo.calls.create.customerApprovalNote, /ติดต่ออีกครั้ง/);
});

test('requires explicit outsource consent before custody can leave the store', () => {
  assert.throws(
    () => assertCanSend(
      job({ deviceIntake: { consent: { allowOutsourceRepair: false } } }),
      'APPROVED',
      null
    ),
    (error) => error.code === 'REPAIR_CONFLICT' && error.statusCode === 409
  );
});

test('blocks a second active subcontract for the same repair job', () => {
  assert.throws(
    () => assertCanSend(
      job(),
      'REPAIRING',
      { id: 12, status: 'SENT', providerName: 'ร้านเดิม' }
    ),
    (error) => error.code === 'REPAIR_CONFLICT' && error.details.subcontractId === 12
  );
});

test('blocks subcontract handoff while an active warranty claim owns the device', () => {
  assert.throws(
    () => assertCanSend(
      job({ warrantyClaims: [{ id: 3, claimNo: 'CL-3', status: 'SUBMITTED' }] }),
      'APPROVED',
      null
    ),
    (error) => error.code === 'REPAIR_CONFLICT' && error.details.warrantyClaimId === 3
  );
});

test('requires either a rough amount or a customer agreement note before sending', async () => {
  const repo = repositoryFor({
    workflowStatus: 'REPAIRING',
    job: job({ estimatedCost: 0 }),
  });
  const service = new RepairSubcontractService(repo);

  await assert.rejects(
    service.send(
      { branchId: 2, employeeId: 35 },
      41,
      { expensePayeeId: 19, providerName: 'ร้าน A', workScope: 'ตรวจเมนบอร์ด' }
    ),
    (error) => error.code === 'REPAIR_INVALID_INPUT'
  );
});
