'use strict';

// Read-only Recovery/Test database authority preflight.
//
// Purpose:
// - load the same local recovery environment files used by restore tooling;
// - verify the configured target is the approved Recovery/Test database;
// - verify the target is distinct from configured Production/source database URLs;
// - never require write/reset approvals and never connect to or mutate the DB.
//
// Usage:
//   node recovery/preflightRecoveryTarget.js

const fs = require('fs');
const path = require('path');

require('dotenv').config();

const RESTORE_ENV_PATH = path.join(process.cwd(), '.env.restore');
const RECOVERY_ENV_PATH = path.join(process.cwd(), '.env.recovery');

if (fs.existsSync(RESTORE_ENV_PATH)) {
  require('dotenv').config({ path: RESTORE_ENV_PATH, override: false });
}
if (fs.existsSync(RECOVERY_ENV_PATH)) {
  require('dotenv').config({ path: RECOVERY_ENV_PATH, override: false });
}

const { inspectTestDatabaseAuthority } = require('./testDatabaseAuthority');

function main() {
  const targetUrl = process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL;
  const result = inspectTestDatabaseAuthority({
    targetUrl,
    requiresWriteApproval: false,
    requiresResetApproval: false,
  });

  const output = {
    result: result.ok ? 'PASS' : 'FAIL',
    databaseModified: false,
    ok: result.ok,
    errors: result.errors,
    target: result.target,
  };

  console.log(JSON.stringify(output, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}

main();
