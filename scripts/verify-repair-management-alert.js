const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  MANAGEMENT_ALERT_CONTRACT_VERSION,
  ALERT_SEVERITY,
  buildManagementAlertProjection,
} = require('../src/modules/repair/services/repairManagementAlertService');

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function run() {
  const now = new Date('2026-07-26T12:00:00.000Z');
  const jobs = [
    {
      id: 1,
      jobNo: 'ALT-001',
      customerId: 10,
      technicianId: null,
      status: 'RECEIVED',
      createdAt: '2026-07-23T00:00:00.000Z',
      updatedAt: '2026-07-23T02:00:00.000Z',
      warrantyClaims: [],
      metadata: {},
    },
    {
      id: 2,
      jobNo: 'ALT-002',
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
      jobNo: 'ALT-003',
      customerId: 12,
      technicianId: 8,
      status: 'COMPLETED',
      createdAt: '2026-07-25T00:00:00.000Z',
      updatedAt: '2026-07-25T10:00:00.000Z',
      warrantyClaims: [],
      metadata: {},
    },
  ];

  const projection = buildManagementAlertProjection(jobs, now);
  assert.strictEqual(projection.contractVersion, MANAGEMENT_ALERT_CONTRACT_VERSION);
  assert.strictEqual(projection.attention, 'IMMEDIATE');
  assert.ok(projection.counters.totalAlerts > 0);
  assert.ok(projection.counters.criticalAlerts > 0);
  assert.ok(projection.counters.escalationJobs > 0);
  assert.ok(projection.alerts.some((item) => item.code === 'CRITICAL_REPAIR_JOBS'));
  assert.ok(projection.alerts.some((item) => item.code === 'UNASSIGNED_REPAIR_JOBS'));
  assert.ok(projection.alerts.every((item, index, items) => {
    if (index === 0) return true;
    const weight = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    return weight[items[index - 1].severity] <= weight[item.severity];
  }));
  assert.ok(projection.escalationQueue.every((item) => (
    item.highestRiskLevel === 'CRITICAL' || item.overdueHours > 0
  )));
  assert.ok(projection.escalationQueue.every((item) => ['CRITICAL_RISK', 'SLA_OVERDUE'].includes(item.escalationReason)));
  assert.ok(projection.alerts.some((item) => item.severity === ALERT_SEVERITY.CRITICAL));

  const empty = buildManagementAlertProjection([], now);
  assert.strictEqual(empty.attention, 'NORMAL');
  assert.strictEqual(empty.counters.escalationJobs, 0);
  assert.strictEqual(empty.alerts.length, 1);
  assert.strictEqual(empty.alerts[0].code, 'NO_IMMEDIATE_MANAGEMENT_ACTION');
  assert.strictEqual(empty.alerts[0].severity, ALERT_SEVERITY.INFO);

  const controllerSource = source('src/modules/repair/controllers/repairController.js');
  const routeSource = source('src/modules/repair/routes/repairRoutes.js');
  const serviceSource = source('src/modules/repair/services/repairManagementAlertService.js');

  assert.ok(controllerSource.includes("require('../services/repairManagementAlertService')"));
  assert.ok(controllerSource.includes('getManagementAlertDashboard'));
  assert.ok(routeSource.includes("router.get('/dashboard/alerts'"));
  assert.ok(serviceSource.includes('repair-management-alert.v1'));
  assert.ok(serviceSource.includes('buildEscalationQueue'));

  console.log('Repair management alert verifier: PASS');
}

run();
