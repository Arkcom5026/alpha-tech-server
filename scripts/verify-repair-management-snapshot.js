const assert = require('assert');

const {
  buildDashboardProjection,
} = require('../src/modules/repair/services/repairOperationalIntelligenceService');
const {
  buildOperationalRiskProjection,
} = require('../src/modules/repair/services/repairOperationalRiskService');
const {
  buildOperationalDecisionProjection,
} = require('../src/modules/repair/services/repairOperationalDecisionService');

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stable(value[key]);
      return result;
    }, {});
  }
  return value;
}

function run() {
  const now = new Date('2026-07-26T12:00:00.000Z');
  const jobs = [
    {
      id: 101,
      jobNo: 'MGR-101',
      customerId: 501,
      technicianId: null,
      status: 'RECEIVED',
      createdAt: '2026-07-23T00:00:00.000Z',
      updatedAt: '2026-07-23T02:00:00.000Z',
      warrantyClaims: [],
      metadata: {},
    },
    {
      id: 102,
      jobNo: 'MGR-102',
      customerId: 502,
      technicianId: 71,
      technician: { displayName: 'ช่างหนึ่ง' },
      status: 'WAITING_APPROVAL',
      createdAt: '2026-07-24T00:00:00.000Z',
      updatedAt: '2026-07-24T04:00:00.000Z',
      warrantyClaims: [],
      metadata: {},
    },
    {
      id: 103,
      jobNo: 'MGR-103',
      customerId: 503,
      technicianId: 72,
      technician: { displayName: 'ช่างสอง' },
      status: 'IN_PROGRESS',
      createdAt: '2026-07-26T08:00:00.000Z',
      updatedAt: '2026-07-26T11:00:00.000Z',
      warrantyClaims: [],
      metadata: {},
    },
  ];

  const dashboard = stable(buildDashboardProjection(jobs, now));
  const risks = stable(buildOperationalRiskProjection(jobs, now));
  const decisions = stable(buildOperationalDecisionProjection(jobs, now));

  assert.deepStrictEqual(dashboard.counters, {
    active: 3,
    cancelled: 0,
    completed: 0,
    diagnosing: 0,
    inProgress: 1,
    overdue: 2,
    received: 1,
    repeatRepair: 0,
    total: 3,
    unassigned: 1,
    waitingApproval: 1,
    waitingParts: 0,
    warrantyRelated: 0,
  });

  assert.strictEqual(risks.contractVersion, 'repair-operational-risk.v1');
  assert.strictEqual(risks.counters.affectedJobs, 2);
  assert.strictEqual(risks.health.activeJobs, 3);
  assert.ok(risks.actionQueue.length >= 2);

  assert.strictEqual(decisions.contractVersion, 'repair-operational-decision.v1');
  assert.deepStrictEqual(decisions.managerSummary, {
    actionableJobs: 2,
    actionableRate: 0.67,
    activeJobs: 3,
    attention: 'IMMEDIATE',
    criticalJobs: 2,
    customerContactJobs: 1,
    overdueJobs: 2,
    partsFollowUpJobs: 0,
    slaAtRiskJobs: 0,
    slaOverdueRate: 0.67,
    topActions: [
      { action: 'ASSIGN_TECHNICIAN', count: 1 },
      { action: 'CONTACT_CUSTOMER', count: 1 },
    ],
    unassignedJobs: 1,
  });
  assert.deepStrictEqual(
    decisions.priorityQueue.map((item) => ({ id: item.repairJobId, action: item.action })),
    [
      { id: 101, action: 'ASSIGN_TECHNICIAN' },
      { id: 102, action: 'CONTACT_CUSTOMER' },
    ]
  );

  const emptyDashboard = buildDashboardProjection([], now);
  const emptyRisks = buildOperationalRiskProjection([], now);
  const emptyDecisions = buildOperationalDecisionProjection([], now);
  assert.strictEqual(emptyDashboard.counters.total, 0);
  assert.strictEqual(emptyRisks.counters.total, 0);
  assert.strictEqual(emptyRisks.health.score, 100);
  assert.strictEqual(emptyDecisions.managerSummary.attention, 'NORMAL');

  console.log('Repair management snapshot verifier: PASS');
}

run();
