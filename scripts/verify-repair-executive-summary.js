const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  EXECUTIVE_SUMMARY_CONTRACT_VERSION,
  buildHealthBand,
  buildHealthScore,
  buildExecutiveSummaryProjection,
} = require('../src/modules/repair/services/repairExecutiveSummaryService');

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function run() {
  const now = new Date('2026-07-26T12:00:00.000Z');
  const jobs = [
    {
      id: 1,
      jobNo: 'EXEC-001',
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
      jobNo: 'EXEC-002',
      customerId: 11,
      technicianId: 7,
      status: 'WAITING_APPROVAL',
      createdAt: '2026-07-24T00:00:00.000Z',
      updatedAt: '2026-07-24T01:00:00.000Z',
      warrantyClaims: [],
      metadata: {},
    },
  ];

  assert.strictEqual(buildHealthBand(90), 'HEALTHY');
  assert.strictEqual(buildHealthBand(70), 'WATCH');
  assert.strictEqual(buildHealthBand(50), 'CRITICAL');
  assert.strictEqual(buildHealthScore({
    criticalJobs: 0,
    overdueJobs: 0,
    unassignedJobs: 0,
    escalationJobs: 0,
    actionableRate: 0,
  }), 100);

  const summary = buildExecutiveSummaryProjection(jobs, now);
  assert.strictEqual(summary.contractVersion, EXECUTIVE_SUMMARY_CONTRACT_VERSION);
  assert.ok(summary.healthScore >= 0 && summary.healthScore <= 100);
  assert.ok(['HEALTHY', 'WATCH', 'CRITICAL'].includes(summary.healthBand));
  assert.ok(summary.narrative.includes(`${summary.healthScore}/100`));
  assert.strictEqual(summary.attention, 'IMMEDIATE');
  assert.ok(Array.isArray(summary.priorityFocus));
  assert.ok(summary.priorityFocus.length > 0 && summary.priorityFocus.length <= 3);
  assert.strictEqual(summary.priorityFocus[0].code, 'RESOLVE_CRITICAL_JOBS');
  assert.ok(summary.dimensions.slaHealth >= 0 && summary.dimensions.slaHealth <= 100);
  assert.ok(summary.dimensions.workforceHealth >= 0 && summary.dimensions.workforceHealth <= 100);
  assert.ok(summary.escalationQueue.length <= 5);
  assert.ok(summary.alertDigest.length <= 5);

  const empty = buildExecutiveSummaryProjection([], now);
  assert.strictEqual(empty.healthScore, 100);
  assert.strictEqual(empty.healthBand, 'HEALTHY');
  assert.strictEqual(empty.attention, 'NORMAL');
  assert.strictEqual(empty.priorityFocus[0].code, 'MAINTAIN_OPERATIONAL_HEALTH');

  const controllerSource = source('src/modules/repair/controllers/repairController.js');
  const routeSource = source('src/modules/repair/routes/repairRoutes.js');
  const serviceSource = source('src/modules/repair/services/repairExecutiveSummaryService.js');

  assert.ok(controllerSource.includes("require('../services/repairExecutiveSummaryService')"));
  assert.ok(controllerSource.includes('getExecutiveSummary'));
  assert.ok(routeSource.includes("router.get('/dashboard/executive-summary'"));
  assert.ok(serviceSource.includes('repair-executive-summary.v1'));
  assert.ok(serviceSource.includes('buildHealthScore'));
  assert.ok(serviceSource.includes('buildPriorityFocus'));
  assert.ok(serviceSource.includes('buildExecutiveSummaryProjection'));

  console.log('Repair executive summary verifier: PASS');
}

run();
