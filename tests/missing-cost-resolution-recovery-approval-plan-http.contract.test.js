const assert = require('node:assert/strict');
const fs = require('node:fs');

const controller = require('../src/modules/inventory/recovery/missing-cost-resolution/runtime/controller/missingCostResolutionRecoveryPreviewController');
const routesSource = fs.readFileSync(require.resolve('../src/modules/inventory/recovery/missing-cost-resolution/runtime/routes/missingCostResolutionRecoveryPreviewRoutes'), 'utf8');
const controllerSource = fs.readFileSync(require.resolve('../src/modules/inventory/recovery/missing-cost-resolution/runtime/controller/missingCostResolutionRecoveryPreviewController'), 'utf8');

assert.equal(typeof controller.getApprovalPlan, 'function');
assert.match(routesSource, /router\.get\('\/:resolutionId\/recovery-approval-plan',\s*controller\.getApprovalPlan\)/);
assert.match(routesSource, /router\.use\(verifyToken\)/);
assert.doesNotMatch(routesSource, /router\.(post|put|patch|delete)\s*\(/);
assert.doesNotMatch(controllerSource, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/);
assert.match(controllerSource, /service\.buildPreview/);
assert.match(controllerSource, /buildMissingCostResolutionRecoveryApprovalPlan/);

assert.equal(controller.buildOperatorIdentity({ employeeId: 42 }), 'employee:42');
assert.equal(controller.buildOperatorIdentity({ id: 51 }), 'employee:51');
assert.equal(controller.buildOperatorIdentity({ email: 'operator@example.com' }), 'user:operator@example.com');
assert.equal(controller.buildOperatorIdentity({}), '');

console.log('missing-cost-resolution-recovery-approval-plan-http.contract.test.js: PASS');
