const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  buildDashboardProjection,
  buildTechnicianProjection,
  buildSlaProjection,
} = require('../src/modules/repair/services/repairOperationalIntelligenceService');
const {
  OPERATIONAL_RISK_CONTRACT_VERSION,
  buildOperationalRiskProjection,
} = require('../src/modules/repair/services/repairOperationalRiskService');

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function run() {
  const now = new Date('2026-07-26T12:00:00.000Z');
  const jobs = [
    {
      id: 1,
      jobNo: 'R-001',
      customerId: 10,
      technicianId: null,
      status: 'RECEIVED',
      createdAt: '2026-07-24T00:00:00.000Z',
      updatedAt: '2026-07-24T01:00:00.000Z',
      warrantyClaims: [],
      metadata: {},
    },
    {
      id: 2,
      jobNo: 'R-002',
      customerId: 11,
      technicianId: 7,
      technician: { displayName: 'ช่างหนึ่ง' },
      status: 'WAITING_APPROVAL',
      createdAt: '2026-07-24T06:00:00.000Z',
      updatedAt: '2026-07-24T06:00:00.000Z',
      warrantyClaims: [],
      metadata: {},
    },
    {
      id: 3,
      jobNo: 'R-003',
      customerId: 12,
      technicianId: 7,
      technician: { displayName: 'ช่างหนึ่ง' },
      status: 'COMPLETED',
      createdAt: '2026-07-25T12:00:00.000Z',
      updatedAt: '2026-07-25T18:00:00.000Z',
      warrantyClaims: [],
      metadata: {},
    },
  ];

  const dashboard = buildDashboardProjection(jobs, now);
  assert.ok(dashboard.generatedAt);
  assert.deepStrictEqual(Object.keys(dashboard.aging), ['lt24h', 'h24to72', 'h72to168', 'gte168h']);
  assert.strictEqual(dashboard.counters.total, 3);
  assert.strictEqual(dashboard.counters.active, 2);
  assert.strictEqual(dashboard.counters.unassigned, 1);
  assert.strictEqual(dashboard.counters.received, 1);
  assert.strictEqual(dashboard.counters.waitingApproval, 1);
  assert.strictEqual(dashboard.counters.completed, 1);
  assert.ok(Array.isArray(dashboard.overdueJobs));
  assert.ok(Array.isArray(dashboard.technicians));

  const technicians = buildTechnicianProjection(jobs, now);
  const assigned = technicians.find((item) => item.technicianId === 7);
  const unassigned = technicians.find((item) => item.technicianId === null);
  assert.ok(assigned);
  assert.strictEqual(assigned.technicianName, 'ช่างหนึ่ง');
  assert.strictEqual(assigned.counters.total, 2);
  assert.ok(unassigned);
  assert.strictEqual(unassigned.counters.total, 1);

  const sla = buildSlaProjection(jobs[0], now);
  assert.strictEqual(sla.active, true);
  assert.strictEqual(sla.thresholdHours, 24);
  assert.strictEqual(sla.overdue, true);

  const riskProjection = buildOperationalRiskProjection(jobs, now);
  assert.strictEqual(riskProjection.contractVersion, OPERATIONAL_RISK_CONTRACT_VERSION);
  assert.ok(riskProjection.generatedAt);
  assert.ok(riskProjection.counters.total > 0);
  assert.ok(riskProjection.counters.critical > 0);
  assert.ok(riskProjection.health.score >= 0 && riskProjection.health.score <= 100);
  assert.ok(['HEALTHY', 'WATCH', 'AT_RISK'].includes(riskProjection.health.grade));
  assert.ok(riskProjection.breakdown.byCode.UNASSIGNED_ACTIVE_JOB >= 1);
  assert.ok(Array.isArray(riskProjection.actionQueue));
  assert.ok(riskProjection.actionQueue.length > 0);
  assert.ok(riskProjection.items.some((item) => item.code === 'UNASSIGNED_ACTIVE_JOB'));
  assert.ok(riskProjection.items.some((item) => item.code === 'SLA_OVERDUE'));

  const controllerSource = source('src/modules/repair/controllers/repairController.js');
  const routeSource = source('src/modules/repair/routes/repairRoutes.js');
  const riskServiceSource = source('src/modules/repair/services/repairOperationalRiskService.js');

  assert.ok(controllerSource.includes("require('../services/repairOperationalRiskService')"));
  assert.ok(controllerSource.includes('getOperationalRiskDashboard'));
  assert.ok(routeSource.includes("router.get('/dashboard/risks'"));
  assert.ok(riskServiceSource.includes('OPERATIONAL_RISK_CONTRACT_VERSION'));
  assert.ok(riskServiceSource.includes('buildOperationalRiskProjection'));
  assert.ok(riskServiceSource.includes('buildActionQueue'));
  assert.ok(riskServiceSource.includes('buildHealthProjection'));
  assert.ok(riskServiceSource.includes('UNASSIGNED_ACTIVE_JOB'));
  assert.ok(riskServiceSource.includes('SLA_AT_RISK'));
  assert.ok(riskServiceSource.includes('SLA_OVERDUE'));

  console.log('Repair dashboard contract verifier: PASS');
}

run();