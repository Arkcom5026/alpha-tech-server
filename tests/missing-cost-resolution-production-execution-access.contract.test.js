const assert = require('assert');
const {
  isExecutionEnabled,
  assertMissingCostRecoveryExecutionAccess,
} = require('../src/modules/inventory/recovery/missing-cost-resolution/runtime/policy/missingCostResolutionExecutionAccessPolicy');

const adminUser = {
  role: 'ADMIN',
  profileType: 'employee',
  employeeId: 35,
  branchId: 2,
};

assert.strictEqual(isExecutionEnabled({ ALLOW_MISSING_COST_RECOVERY_EXECUTION: 'true' }), true);
assert.strictEqual(isExecutionEnabled({ ALLOW_MISSING_COST_RECOVERY_EXECUTION: 'TRUE' }), true);
assert.strictEqual(isExecutionEnabled({ ALLOW_MISSING_COST_RECOVERY_EXECUTION: 'false' }), false);

assert.throws(
  () => assertMissingCostRecoveryExecutionAccess({
    user: adminUser,
    env: { NODE_ENV: 'production', ALLOW_MISSING_COST_RECOVERY_EXECUTION: 'false' },
  }),
  (error) => error.code === 'MISSING_COST_RECOVERY_EXECUTION_DISABLED' && error.statusCode === 403
);

assert.throws(
  () => assertMissingCostRecoveryExecutionAccess({
    user: { ...adminUser, role: 'EMPLOYEE' },
    env: { NODE_ENV: 'production', ALLOW_MISSING_COST_RECOVERY_EXECUTION: 'true' },
  }),
  (error) => error.code === 'MISSING_COST_RECOVERY_EXECUTION_ROLE_FORBIDDEN' && error.statusCode === 403
);

assert.throws(
  () => assertMissingCostRecoveryExecutionAccess({
    user: { ...adminUser, profileType: 'customer', employeeId: null },
    env: { NODE_ENV: 'production', ALLOW_MISSING_COST_RECOVERY_EXECUTION: 'true' },
  }),
  (error) => error.code === 'MISSING_COST_RECOVERY_EMPLOYEE_AUTHORITY_REQUIRED' && error.statusCode === 403
);

assert.throws(
  () => assertMissingCostRecoveryExecutionAccess({
    user: { ...adminUser, branchId: null },
    env: { NODE_ENV: 'production', ALLOW_MISSING_COST_RECOVERY_EXECUTION: 'true' },
  }),
  (error) => error.code === 'MISSING_COST_RECOVERY_BRANCH_AUTHORITY_REQUIRED' && error.statusCode === 403
);

const productionAuthority = assertMissingCostRecoveryExecutionAccess({
  user: adminUser,
  env: { NODE_ENV: 'production', ALLOW_MISSING_COST_RECOVERY_EXECUTION: 'true' },
});
assert.deepStrictEqual(productionAuthority, {
  employeeId: 35,
  branchId: 2,
  role: 'ADMIN',
  environment: 'production',
  operationalFlag: 'ALLOW_MISSING_COST_RECOVERY_EXECUTION',
});

const testAuthority = assertMissingCostRecoveryExecutionAccess({
  user: { ...adminUser, role: 'SUPERADMIN' },
  env: { NODE_ENV: 'test', ALLOW_MISSING_COST_RECOVERY_EXECUTION: 'true' },
});
assert.strictEqual(testAuthority.environment, 'test');
assert.strictEqual(testAuthority.role, 'SUPERADMIN');

console.log('missing-cost-resolution production execution access contract: PASS');
