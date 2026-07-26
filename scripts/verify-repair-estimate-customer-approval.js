const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  validateRepairEstimate,
  validateRepairEstimateDecision,
  REPAIR_ESTIMATE_ITEM_TYPES,
  REPAIR_ESTIMATE_DECISIONS,
} = require('../src/modules/repair/validators/repairValidator');
const {
  estimateHistory,
} = require('../src/modules/repair/services/repairEstimateService');
const {
  RepairFailureCode,
} = require('../src/modules/repair/contracts/repairError');

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

const estimate = validateRepairEstimate({
  diagnosisId: 'diagnosis-1',
  items: [
    { type: 'LABOR', description: 'ค่าตรวจและซ่อม', quantity: 1, unitPrice: 500 },
    { type: 'PART', description: 'อะไหล่', quantity: 2, unitPrice: 250 },
  ],
  note: 'แจ้งลูกค้าก่อนดำเนินงาน',
});
assert.strictEqual(estimate.items.length, 2);
assert.strictEqual(estimate.items[1].amount, 500);
assert.deepStrictEqual(REPAIR_ESTIMATE_ITEM_TYPES, ['LABOR', 'PART', 'SERVICE', 'OTHER']);
assert.deepStrictEqual(REPAIR_ESTIMATE_DECISIONS, ['APPROVED', 'REJECTED']);
assert.strictEqual(validateRepairEstimateDecision({ decision: 'approved' }).decision, 'APPROVED');
assert.strictEqual(estimateHistory({ repairEstimates: [{ id: 'e1' }] }).length, 1);
assert.strictEqual(RepairFailureCode.REPAIR_DIAGNOSIS_REQUIRED, 'REPAIR_DIAGNOSIS_REQUIRED');
assert.strictEqual(RepairFailureCode.ACTIVE_REPAIR_ESTIMATE_EXISTS, 'REPAIR_ACTIVE_ESTIMATE_EXISTS');
assert.strictEqual(RepairFailureCode.REPAIR_ESTIMATE_ALREADY_DECIDED, 'REPAIR_ESTIMATE_ALREADY_DECIDED');

const serviceSource = source('src/modules/repair/services/repairEstimateService.js');
assert.match(serviceSource, /PENDING_APPROVAL/);
assert.match(serviceSource, /latestRepairEstimate/);
assert.match(serviceSource, /estimatedCost: estimate\.total/);
assert.match(serviceSource, /currency: 'THB'/);
assert.match(serviceSource, /REPAIR_ESTIMATE_ALREADY_DECIDED/);

const routeSource = source('src/modules/repair/routes/repairRoutes.js');
assert.match(routeSource, /jobs\/:id\/estimates/);
assert.match(routeSource, /estimates\/:estimateId\/decision/);

const controllerSource = source('src/modules/repair/controllers/repairController.js');
assert.match(controllerSource, /repairEstimateService\.create/);
assert.match(controllerSource, /repairEstimateService\.decide/);

console.log('Repair Estimate Customer Approval: PASS');
