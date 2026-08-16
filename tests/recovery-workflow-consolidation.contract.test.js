'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

const scheduledBat = read('scripts/run-recovery-task.bat');
const consolidated = read('recovery/consolidatedRecoveryRunner.js');
const jobRunner = read('recovery/jobRunner.js');
const captureBundle = read('recovery/captureRecoveryBundle.js');
const restoreBundle = read('recovery/restoreRecoveryBundle.js');

// One scheduled entrypoint only. Windows Task Scheduler must not independently
// schedule the backup workflow and the standby-clone workflow.
assert.ok(scheduledBat.includes('node recovery\\consolidatedRecoveryRunner.js'));
assert.ok(!scheduledBat.includes('jobRunner.js'));
assert.ok(!scheduledBat.includes('captureRecoveryBundle.js'));
assert.ok(!scheduledBat.includes('restoreRecoveryBundle.js'));

// Workflow A remains the mandatory first stage and keeps the existing backup,
// verification, upload, and retention authority in jobRunner.js.
assert.ok(consolidated.includes("'recovery/jobRunner.js'"));
assert.ok(consolidated.includes("'--backup-workflow'"));
assert.ok(consolidated.includes("'--upload'"));
assert.ok(consolidated.includes("'--retention'"));
assert.ok(consolidated.includes("'--no-standby-restore'"));
assert.ok(jobRunner.includes("const WORKFLOW_STEPS = ['HEALTH_CHECK','BACKUP','VERIFY_BACKUP','UPLOAD','R2_RETENTION','RETENTION','RESTORE_RECOVERY','VERIFY_RECOVERY','REPORT']"));

// Workflow B is consolidated as an optional post-backup PostgreSQL standby
// clone. It must be disabled by default and must never run when Workflow A
// fails.
assert.ok(consolidated.includes("RECOVERY_STANDBY_SYNC_ENABLED || 'false'"));
assert.ok(consolidated.includes('if (!workflowA.ok)'));
assert.ok(consolidated.includes("'recovery/captureRecoveryBundle.js'"));
assert.ok(consolidated.includes("'recovery/restoreRecoveryBundle.js'"));
assert.ok(captureBundle.includes('REPEATABLE READ READ ONLY'));
assert.ok(captureBundle.includes('--schema=public'));
assert.ok(captureBundle.includes('--schema=legacy_tax'));

// Destructive standby writes require both the recovery drill approval and the
// explicit reset confirmation. The target restore implementation retains its
// own Test Database Authority guard as a second independent fence.
assert.ok(consolidated.includes('RECOVERY_DRILL_APPROVAL'));
assert.ok(consolidated.includes('ALPHATECH_RECOVERY_DRILL'));
assert.ok(consolidated.includes('RESTORE_DATABASE_RESET_CONFIRMATION'));
assert.ok(consolidated.includes('ALPHATECH_TEST_DB_RESET'));
assert.ok(restoreBundle.includes('assertTestDatabaseAuthority'));
assert.ok(restoreBundle.includes('RESTORE_DATABASE_RESET_CONFIRMATION'));
assert.ok(!/process\.env\.DATABASE_URL\b/.test(restoreBundle));

// Child process execution must not pass through a shell and logs must redact
// database credentials.
assert.ok(consolidated.includes('shell: false'));
assert.ok(consolidated.includes('RESTORE_DATABASE_URL|RECOVERY_DATABASE_URL'));

console.log('recovery workflow consolidation contract: PASS');
