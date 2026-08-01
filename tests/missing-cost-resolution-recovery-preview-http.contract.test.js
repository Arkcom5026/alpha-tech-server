const assert = require('node:assert/strict');
const fs = require('node:fs');

const controllerPath = '../src/modules/inventory/recovery/missing-cost-resolution/runtime/controller/missingCostResolutionRecoveryPreviewController';
const routesPath = '../src/modules/inventory/recovery/missing-cost-resolution/runtime/routes/missingCostResolutionRecoveryPreviewRoutes';

const controllerSource = fs.readFileSync(require.resolve(controllerPath), 'utf8');
const routesSource = fs.readFileSync(require.resolve(routesPath), 'utf8');
const serverSource = fs.readFileSync(require.resolve('../server'), 'utf8');

assert.match(routesSource, /router\.use\(verifyToken\)/);
assert.match(routesSource, /router\.get\('\/:resolutionId\/recovery-preview', controller\.getPreview\)/);
assert.doesNotMatch(routesSource, /router\.(post|put|patch|delete)\s*\(/);
assert.doesNotMatch(controllerSource, /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/);
assert.match(controllerSource, /branchId:\s*req\.user\?\.branchId/);
assert.match(controllerSource, /resolutionId:\s*req\.params\.resolutionId/);
assert.match(controllerSource, /operatorIdentity:\s*buildOperatorIdentity\(req\.user\)/);
assert.match(serverSource, /missingCostResolutionRecoveryPreviewRoutes/);
assert.match(serverSource, /app\.use\('\/api\/inventory-recovery\/missing-cost-resolutions', missingCostResolutionRecoveryPreviewRoutes\)/);

const { buildOperatorIdentity } = require(controllerPath);
assert.equal(buildOperatorIdentity({ employeeId: 41 }), 'employee:41');
assert.equal(buildOperatorIdentity({ id: 42 }), 'employee:42');
assert.equal(buildOperatorIdentity({ email: 'operator@example.com' }), 'user:operator@example.com');
assert.equal(buildOperatorIdentity({}), '');

console.log('missing-cost-resolution-recovery-preview-http.contract.test.js: PASS');
