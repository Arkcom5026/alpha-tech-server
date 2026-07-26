const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { buildTimeline } = require('../src/modules/repair/services/repairAssetTimelineService');
const { repeatRepairLinks } = require('../src/modules/repair/services/repairRepeatLinkService');
const { positiveWarrantyDays } = require('../src/modules/repair/services/repairWarrantyService');
const { RepairFailureCode } = require('../src/modules/repair/contracts/repairError');

assert.equal(positiveWarrantyDays(90), 90);
assert.throws(() => positiveWarrantyDays(0), (error) => error.code === RepairFailureCode.REPAIR_WARRANTY_PERIOD_INVALID);
assert.deepEqual(repeatRepairLinks({ repeatRepairLinks: [{ id: '1' }] }), [{ id: '1' }]);

const timeline = buildTimeline(
  {
    id: 20,
    jobNo: 'REP-20',
    createdAt: '2026-01-01T00:00:00.000Z',
    reportedSymptoms: 'เปิดไม่ติด',
  },
  {
    metadata: {
      repairPayments: [{ repairJobId: 20, receivedAt: '2026-01-03T00:00:00.000Z', amount: '500.00' }],
      customerHandovers: [{ repairJobId: 20, handedOverAt: '2026-01-05T00:00:00.000Z' }],
      repairWarranties: [{ repairJobId: 20, status: 'ACTIVE', startedAt: '2026-01-05T00:00:00.000Z', expiresAt: '2026-04-05T00:00:00.000Z' }],
      repeatRepairLinks: [{ repairJobId: 21, previousRepairJobId: 20, linkedAt: '2026-02-01T00:00:00.000Z' }],
    },
  }
);
assert.deepEqual(timeline.map((item) => item.type), [
  'REPAIR_RECEIVED',
  'PAYMENT_RECORDED',
  'CUSTOMER_HANDOVER',
  'REPAIR_WARRANTY_STARTED',
  'REPEAT_REPAIR_LINKED',
]);

const controllerSource = fs.readFileSync(path.join(__dirname, '../src/modules/repair/controllers/repairController.js'), 'utf8');
const routesSource = fs.readFileSync(path.join(__dirname, '../src/modules/repair/routes/repairRoutes.js'), 'utf8');
const completionSource = fs.readFileSync(path.join(__dirname, '../src/modules/repair/services/repairCompletionService.js'), 'utf8');
const handoverSource = fs.readFileSync(path.join(__dirname, '../src/modules/repair/services/repairHandoverService.js'), 'utf8');

assert.match(controllerSource, /linkRepeatRepair/);
assert.match(controllerSource, /getAssetTimeline/);
assert.match(routesSource, /repeat-repair-link/);
assert.match(routesSource, /asset-timeline/);
assert.match(routesSource, /repair-warranties/);
assert.match(completionSource, /assertCompletionReadiness/);
assert.match(handoverSource, /signatureRef/);
assert.match(handoverSource, /customerHandovers/);

console.log('Repair After-Service Milestone: PASS');
