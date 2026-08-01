const assert = require('node:assert/strict');
const fs = require('node:fs');

const controllerPath = require.resolve('../src/modules/inventory/recovery/missing-cost-resolution/runtime/controller/missingCostResolutionRecoveryExecutionController');
const routesPath = require.resolve('../src/modules/inventory/recovery/missing-cost-resolution/runtime/routes/missingCostResolutionRecoveryExecutionRoutes');

const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  ALLOW_MISSING_COST_RECOVERY_EXECUTION: process.env.ALLOW_MISSING_COST_RECOVERY_EXECUTION,
};

const restoreEnv = () => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};

(async () => {
  delete require.cache[controllerPath];
  const controller = require(controllerPath);

  process.env.NODE_ENV = 'production';
  process.env.DATABASE_URL = 'postgresql://production.example/alpha';
  process.env.ALLOW_MISSING_COST_RECOVERY_EXECUTION = 'false';
  assert.throws(
    () => controller.requireTestDatabaseAuthority(),
    (error) => error.code === 'MISSING_COST_RECOVERY_TEST_DB_AUTHORITY_REQUIRED' && error.statusCode === 403
  );

  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://localhost/alpha_test';
  process.env.ALLOW_MISSING_COST_RECOVERY_EXECUTION = 'true';
  assert.doesNotThrow(() => controller.requireTestDatabaseAuthority());

  const routeSource = fs.readFileSync(routesPath, 'utf8');
  const controllerSource = fs.readFileSync(controllerPath, 'utf8');
  const serverSource = fs.readFileSync(require.resolve('../server'), 'utf8');

  assert.match(routeSource, /router\.use\(verifyToken\)/);
  assert.match(routeSource, /router\.post\('\/:resolutionId\/recovery-execution'/);
  assert.doesNotMatch(routeSource, /router\.(put|patch|delete)\s*\(/);
  assert.match(controllerSource, /X-Idempotency-Key/);
  assert.match(controllerSource, /requireTestDatabaseAuthority\(\)/);
  assert.match(controllerSource, /approval:\s*\{/);
  assert.match(serverSource, /missingCostResolutionRecoveryExecutionRoutes/);
  assert.match(serverSource, /app\.use\('\/api\/inventory-recovery\/missing-cost-resolutions', missingCostResolutionRecoveryExecutionRoutes\)/);

  restoreEnv();
  console.log('missing-cost-resolution-recovery-execution-http.contract.test.js: PASS');
})().catch((error) => {
  restoreEnv();
  console.error(error);
  process.exitCode = 1;
});
