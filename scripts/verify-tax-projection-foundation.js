const { spawnSync } = require('node:child_process');

const checks = Object.freeze([
  {
    name: 'Sale tax completion integration',
    script: 'scripts/verify-tax-sale-completion-integration.js',
  },
  {
    name: 'Sale tax projection gateway',
    script: 'scripts/verify-tax-sale-projection-gateway.js',
  },
]);

const runCheck = ({ name, script }) => {
  process.stdout.write(`\n[Tax Projection Gate] ${name}\n`);

  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const error = new Error(`${name} failed with exit code ${result.status}`);
    error.code = 'TAX_PROJECTION_GATE_FAILED';
    error.check = name;
    error.script = script;
    error.exitCode = result.status;
    throw error;
  }
};

const verifyTaxProjectionFoundation = () => {
  for (const check of checks) {
    runCheck(check);
  }

  process.stdout.write('\nTax projection foundation verification: PASS\n');
};

try {
  verifyTaxProjectionFoundation();
} catch (error) {
  console.error('\nTax projection foundation verification: FAIL');
  console.error({
    code: error.code || 'TAX_PROJECTION_GATE_ERROR',
    message: error.message,
    check: error.check || null,
    script: error.script || null,
    exitCode: error.exitCode ?? null,
  });
  process.exitCode = 1;
}

module.exports = {
  checks,
  runCheck,
  verifyTaxProjectionFoundation,
};
