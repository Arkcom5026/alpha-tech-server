const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  DECISION_CONTRACT_VERSION,
  DECISION_ACTION,
  buildOperationalDecision,
  buildOperationalDecisionProjection,
} = require('../src/modules/repair/services/repairOperationalDecisionService');

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function run() {
  const now = new Date('2026-07-26T12:00:00.000Z');
  const jobs = [
    {
      id: 1,
      jobNo: 'DEC-001',
      customerId: 10,
      technicianId: null,
      status: 'RECEIVED',
      createdAt: '2026-07-23T00:00:00.000Z',
      updatedAt: '2026-07-23T01:00:00.000Z',
      warrantyClaims: [],
      metadata: {},
    },
    {
      id: 2,
      jobNo: 'DEC-002',
      customerId: 11,
      technicianId: 7,
      status: 'WAITING_APPROVAL',
      createdAt: '2026-07-24T00:00:00.000Z',
      updatedAt: '2026-07-24T01:00:00.000Z',
      warrantyClaims: [],
      metadata: {},
    },
    {
      id: 3,
      jobNo: 'DEC-003',
      customerId: 12,
      technicianId: 8,
      status: 'COMPLETED',
      createdAt: '2026-07-25T00:00:00.000Z',
      updatedAt: '2026-07-25T08:00:00.000Z',
      warrantyClaims: [],
      metadata: {},
    },
  ];

  const unassigned = buildOperationalDecision(jobs[0], now);
  assert.strictEqual(unassigned.action, DECISION_ACTION.ASSIGN_TECHNICIAN);
  assert.ok(unassigned.riskCodes.includes('UNASSIGNED_ACTIVE_JOB'));
  assert.ok(unassigned.riskCount > 0);

  const approval = buildOperationalDecision(jobs[1], now);
  assert.strictEqual(approval.action, DECISION_ACTION.CONTACT_CUSTOMER);
  assert.ok(approval.riskCodes.includes('APPROVAL_DELAY_RISK'));

  const completed = buildOperationalDecision(jobs[2], now);
  assert.strictEqual(completed.action, DECISION_ACTION.NONE);
  assert.strictEqual(completed.riskCount, 0);

  const projection = buildOperationalDecisionProjection(jobs, now);
  assert.strictEqual(projection.contractVersion, DECISION_CONTRACT_VERSION);
  assert.strictEqual(projection.counters.total, 3);
  assert.strictEqual(projection.counters.actionable, 2);
  assert.strictEqual(projection.priorityQueue.length, 2);
  assert.strictEqual(projection.priorityQueue[0].repairJobId, 1);
  assert.strictEqual(projection.counters.byAction.ASSIGN_TECHNICIAN, 1);
  assert.strictEqual(projection.counters.byAction.CONTACT_CUSTOMER, 1);
  assert.strictEqual(projection.counters.byAction.NONE, 1);

  assert.deepStrictEqual(Object.keys(projection.managerSummary), [
    'activeJobs',
    'actionableJobs',
    'criticalJobs',
    'overdueJobs',
    'slaAtRiskJobs',
    'unassignedJobs',
    'customerContactJobs',
    'partsFollowUpJobs',
    'actionableRate',
    'slaOverdueRate',
    'attention',
    'topActions',
  ]);
  assert.strictEqual(projection.managerSummary.activeJobs, 2);
  assert.strictEqual(projection.managerSummary.actionableJobs, 2);
  assert.strictEqual(projection.managerSummary.criticalJobs, 2);
  assert.strictEqual(projection.managerSummary.unassignedJobs, 1);
  assert.strictEqual(projection.managerSummary.customerContactJobs, 1);
  assert.strictEqual(projection.managerSummary.attention, 'IMMEDIATE');
  assert.ok(Array.isArray(projection.managerSummary.topActions));

  const emptyProjection = buildOperationalDecisionProjection([], now);
  assert.strictEqual(emptyProjection.counters.total, 0);
  assert.strictEqual(emptyProjection.managerSummary.activeJobs, 0);
  assert.strictEqual(emptyProjection.managerSummary.actionableJobs, 0);
  assert.strictEqual(emptyProjection.managerSummary.attention, 'NORMAL');
  assert.deepStrictEqual(emptyProjection.priorityQueue, []);

  const controllerSource = source('src/modules/repair/controllers/repairController.js');
  const routeSource = source('src/modules/repair/routes/repairRoutes.js');
  const serviceSource = source('src/modules/repair/services/repairOperationalDecisionService.js');

  assert.ok(controllerSource.includes("require('../services/repairOperationalDecisionService')"));
  assert.ok(controllerSource.includes('getOperationalDecisionDashboard'));
  assert.ok(routeSource.includes("router.get('/dashboard/decisions'"));
  assert.ok(serviceSource.includes('repair-operational-decision.v1'));
  assert.ok(serviceSource.includes('buildManagerSummary'));
  assert.ok(serviceSource.includes('managerSummary'));
  assert.ok(serviceSource.includes('buildOperationalDecisionProjection'));

  console.log('Repair operational decision verifier: PASS');
}

run();
