const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  buildSlaProjection,
  buildDashboardProjection,
  buildTimelineIntelligence,
} = require('../src/modules/repair/services/repairOperationalIntelligenceService');
const {
  buildRepairCostAnalytics,
} = require('../src/modules/repair/services/repairCostAnalyticsService');
const {
  buildRepeatFailureAnalytics,
} = require('../src/modules/repair/services/repairRepeatFailureAnalyticsService');

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function run() {
  const now = new Date('2026-07-26T12:00:00.000Z');
  const overdueJob = {
    id: 1,
    jobNo: 'R-001',
    branchId: 1,
    customerId: 2,
    technicianId: 3,
    serviceAssetId: 10,
    status: 'RECEIVED',
    createdAt: '2026-07-24T00:00:00.000Z',
    reportedSymptoms: 'เปิดไม่ติด',
    depositPaid: 0,
  };
  const completedJob = {
    ...overdueJob,
    id: 2,
    jobNo: 'R-002',
    status: 'COMPLETED',
    createdAt: '2026-07-25T00:00:00.000Z',
  };

  const sla = buildSlaProjection(overdueJob, now);
  assert.strictEqual(sla.overdue, true);
  assert.strictEqual(sla.thresholdHours, 24);
  assert.strictEqual(sla.overdueHours, 36);

  const dashboard = buildDashboardProjection([overdueJob, completedJob], now);
  assert.strictEqual(dashboard.counters.total, 2);
  assert.strictEqual(dashboard.counters.received, 1);
  assert.strictEqual(dashboard.counters.completed, 1);
  assert.strictEqual(dashboard.counters.overdue, 1);

  const asset = {
    id: 10,
    metadata: {
      repairDiagnoses: [{ repairJobId: 1, recordedAt: '2026-07-24T04:00:00.000Z' }],
      repairEstimates: [],
      repairPayments: [],
      repairInvoices: [],
      customerHandovers: [],
      repairWarranties: [],
      repeatRepairLinks: [],
    },
  };
  const timeline = buildTimelineIntelligence(overdueJob, asset, now);
  assert.ok(timeline.eventCount >= 1);
  assert.ok(Array.isArray(timeline.stageDurations));

  const estimate = {
    id: 'est-1',
    repairJobId: 1,
    status: 'APPROVED',
    total: '1500.00',
    decidedAt: '2026-07-24T06:00:00.000Z',
    currency: 'THB',
    items: [
      { type: 'LABOR', amount: '500.00' },
      { type: 'PART', amount: '1000.00' },
    ],
  };
  const parts = [{ id: 1, productId: 10, qtyUsed: 1, unitPrice: '800.00' }];
  const cost = buildRepairCostAnalytics({
    job: overdueJob,
    estimates: [estimate],
    parts,
    calculatedAt: now,
  });
  assert.strictEqual(cost.revenue.approvedTotal, 1500);
  assert.strictEqual(cost.cost.actualPartAmount, 800);
  assert.strictEqual(cost.profitability.estimatedGrossContribution, 700);
  assert.strictEqual(cost.profitability.lossMaking, false);

  const repeatAsset = {
    id: 10,
    metadata: {
      repeatRepairLinks: [
        {
          repairJobId: 2,
          previousRepairJobId: 1,
          linkedAt: '2026-07-25T01:00:00.000Z',
        },
      ],
      repairWarranties: [],
    },
  };
  const repeat = buildRepeatFailureAnalytics(
    completedJob,
    repeatAsset,
    [overdueJob, completedJob],
    now
  );
  assert.strictEqual(repeat.repeatRepair, true);
  assert.strictEqual(repeat.previousRepairJob.id, 1);
  assert.ok(repeat.failurePattern.mtbfHours > 0);

  const controllerSource = source('src/modules/repair/controllers/repairController.js');
  const routeSource = source('src/modules/repair/routes/repairRoutes.js');
  assert.ok(controllerSource.includes('getOperationalDashboard'));
  assert.ok(controllerSource.includes('getOperationalIntelligence'));
  assert.ok(controllerSource.includes('getCostAnalytics'));
  assert.ok(controllerSource.includes('getRepeatFailureAnalytics'));
  assert.ok(routeSource.includes("router.get('/dashboard'"));
  assert.ok(routeSource.includes("/jobs/:id/operational-intelligence"));
  assert.ok(routeSource.includes("/jobs/:id/cost-analytics"));
  assert.ok(routeSource.includes("/jobs/:id/repeat-failure-analytics"));

  console.log('Repair operational intelligence verifier: PASS');
}

run();
