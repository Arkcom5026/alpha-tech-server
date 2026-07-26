const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  MANAGEMENT_BRIEF_CONTRACT_VERSION,
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

  const empty = buildDailyManagementBrief([], now);
  assert.strictEqual(empty.attention, 'NORMAL');
  assert.ok(empty.headline.includes('ภาวะปกติ'));
  assert.strictEqual(empty.overview.activeJobs, 0);
  assert.strictEqual(empty.overview.actionableJobs, 0);
  assert.strictEqual(empty.overview.escalationJobs, 0);
  assert.strictEqual(empty.alertDigest[0].code, 'NO_IMMEDIATE_MANAGEMENT_ACTION');

  const controllerSource = source('src/modules/repair/controllers/repairController.js');
  const routeSource = source('src/modules/repair/routes/repairRoutes.js');
  const serviceSource = source('src/modules/repair/services/repairManagementBriefService.js');

  assert.ok(controllerSource.includes("require('../services/repairManagementBriefService')"));
  assert.ok(controllerSource.includes('getManagementDailyBrief'));
  assert.ok(routeSource.includes("router.get('/dashboard/brief'"));
  assert.ok(serviceSource.includes('repair-management-brief.v1'));
  assert.ok(serviceSource.includes('buildAlertDigest'));
  assert.ok(serviceSource.includes('buildDailyManagementBrief'));

  console.log('Repair management brief verifier: PASS');
}

run();
