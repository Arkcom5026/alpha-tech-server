const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const preview = read('src/modules/inventory/recovery/missing-cost-resolution/recovery-preview/buildApprovedResolutionRecoveryPreview.js');
const plan = read('src/modules/inventory/recovery/missing-cost-resolution/recovery-plan/buildMissingCostResolutionRecoveryApprovalPlan.js');
const authority = read('src/modules/inventory/recovery/missing-cost-resolution/recovery-execution/buildMissingCostResolutionRecoveryExecutionAuthority.js');
const controller = read('src/modules/inventory/recovery/missing-cost-resolution/runtime/controller/missingCostResolutionRecoveryExecutionController.js');
const accessPolicy = read('src/modules/inventory/recovery/missing-cost-resolution/runtime/policy/missingCostResolutionExecutionAccessPolicy.js');

assert.match(preview, /approvalSnapshot\?\.approvedByEmployeeId/);
assert.match(preview, /approvalIdentity/);
assert.match(plan, /preview\.approvalIdentity/);
assert.match(plan, /serverOwnedApprovalIdentity:\s*true/);
assert.match(authority, /validatedPlan\.approvalIdentity/);
assert.match(authority, /approvalIdentityIsServerOwned:\s*true/);
assert.doesNotMatch(authority, /approval\?\.approvalIdentity/);

assert.match(controller, /assertMissingCostRecoveryExecutionAccess/);
assert.match(controller, /accessAuthority\.branchId/);
assert.doesNotMatch(controller, /req\.body.*branchId/);
assert.doesNotMatch(controller, /req\.body.*approvalIdentity/);

assert.match(accessPolicy, /ALLOW_MISSING_COST_RECOVERY_EXECUTION/);
assert.match(accessPolicy, /ADMIN/);
assert.match(accessPolicy, /SUPERADMIN/);
assert.match(accessPolicy, /employeeId/);
assert.match(accessPolicy, /branchId/);

console.log('missing-cost-recovery-server-owned-approval.contract.test.js: PASS');
