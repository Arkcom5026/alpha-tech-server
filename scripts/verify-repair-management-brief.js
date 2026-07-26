const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  MANAGEMENT_BRIEF_CONTRACT_VERSION,
  buildManagementKpiSnapshot,
  buildTrendProjection,
  buildDailyManagementBrief,
} = require('../src/modules/repair/services/repairManagementBriefService');

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function run() {
  const now = new Date('2026-07-26T12:00:00.000Z');
  const jobs = [
    {
      id: 1,
      jobNo: 'BRIEF-001',
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
      jobNo: 'BRIEF-002',
      customerId: 11,
      technicianId: 7,
      status: 'WAITING_APPROVAL',
      createdAt: '2026-07-24T00:00:00.000Z',
      updatedAt: '2026-07-24T01:00:00.000Z',
      warrantyClaims: [],
      metadata: {},
    },
  ];

  const brief = buildDailyManagementBrief(jobs, now);
  assert.strictEqual(brief.contractVersion, MANAGEMENT_BRIEF_CONTRACT_VERSION);
  assert.strictEqual(brief.attention, 'IMMEDIATE');
  assert.ok(brief.headline.includes('จัดการทันที'));
  assert.strictEqual(brief.overview.activeJobs, 2);
  assert.strictEqual(brief.overview.actionableJobs, 2);
  assert.ok(brief.overview.criticalJobs > 0);
  assert.ok(brief.alertCounters.totalAlerts > 0);
  assert.ok(Array.isArray(brief.alertDigest));
  assert.ok(Array.isArray(brief.escalationQueue));
  assert.ok(brief.escalationQueue.length > 0);
  assert.ok(Array.isArray(brief.topActions));

  assert.strictEqual(brief.kpis.activeJobs, 2);
  assert.strictEqual(brief.kpis.actionableJobs, 2);
  assert.strictEqual(brief.kpis.unassignedJobs, 1);
  assert.strictEqual(brief.kpis.actionableRate, 1);
  assert.strictEqual(brief.kpis.assignmentCoverageRate, 0.5);
  assert.ok(brief.kpis.escalationRate >= 0 && brief.kpis.escalationRate <= 1);
  assert.deepStrictEqual(brief.trend, {
    available: false,
    direction: 'STABLE',
    deltas: {},
  });

  const current = {
    activeJobs: 5,
    actionableJobs: 3,
    criticalJobs: 2,
    overdueJobs: 2,
    unassignedJobs: 1,
    escalationJobs: 2,
  };
  const baseline = {
    activeJobs: 4,
    actionableJobs: 2,
    criticalJobs: 1,
    overdueJobs: 1,
    unassignedJobs: 1,
    escalationJobs: 1,
  };
  const worsening = buildTrendProjection(current, baseline);
  assert.strictEqual(worsening.available, true);
  assert.strictEqual(worsening.direction, 'WORSENING');
  assert.deepStrictEqual(worsening.deltas, {
    activeJobs: 1,
    actionableJobs: 1,
    criticalJobs: 1,
    overdueJobs: 1,
    unassignedJobs: 0,
    escalationJobs: 1,
  });

  const improving = buildTrendProjection(baseline, current);
  assert.strictEqual(improving.direction, 'IMPROVING');

  const stable = buildTrendProjection(current, { ...current });
  assert.strictEqual(stable.direction, 'STABLE');
  assert.ok(Object.values(stable.deltas).every((value) => value === 0));

  const empty = buildDailyManagementBrief([], now);
  assert.strictEqual(empty.attention, 'NORMAL');
  assert.ok(empty.headline.includes('ภาวะปกติ'));
  assert.strictEqual(empty.overview.activeJobs, 0);
  assert.strictEqual(empty.overview.actionableJobs, 0);
  assert.strictEqual(empty.overview.escalationJobs, 0);
  assert.strictEqual(empty.kpis.assignmentCoverageRate, 0);
  assert.strictEqual(empty.kpis.escalationRate, 0);
  assert.strictEqual(empty.alertDigest[0].code, 'NO_IMMEDIATE_MANAGEMENT_ACTION');

  const syntheticKpis = buildManagementKpiSnapshot({
    managerSummary: {
      activeJobs: 4,
      actionableJobs: 2,
      criticalJobs: 1,
      overdueJobs: 1,
      unassignedJobs: 1,
      actionableRate: 0.5,
      slaOverdueRate: 0.25,
    },
    counters: { escalationJobs: 2 },
  });
  assert.strictEqual(syntheticKpis.assignmentCoverageRate, 0.75);
  assert.strictEqual(syntheticKpis.escalationRate, 0.5);

  const controllerSource = source('src/modules/repair/controllers/repairController.js');
  const routeSource = source('src/modules/repair/routes/repairRoutes.js');
  const serviceSource = source('src/modules/repair/services/repairManagementBriefService.js');

  assert.ok(controllerSource.includes("require('../services/repairManagementBriefService')"));
  assert.ok(controllerSource.includes('getManagementDailyBrief'));
  assert.ok(routeSource.includes("router.get('/dashboard/brief'"));
  assert.ok(serviceSource.includes('repair-management-brief.v1'));
  assert.ok(serviceSource.includes('buildAlertDigest'));
  assert.ok(serviceSource.includes('buildManagementKpiSnapshot'));
  assert.ok(serviceSource.includes('buildTrendProjection'));
  assert.ok(serviceSource.includes('buildDailyManagementBrief'));

  console.log('Repair management brief verifier: PASS');
}

run();