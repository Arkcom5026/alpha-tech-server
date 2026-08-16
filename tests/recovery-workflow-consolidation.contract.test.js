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

// One scheduled entrypoint only.
assert.ok(scheduledBat.includes('node recovery\\consolidatedRecoveryRunner.js'));
assert.ok(!scheduledBat.includes('jobRunner.js'));
assert.ok(!scheduledBat.includes('captureRecoveryBundle.js'));
assert.ok(!scheduledBat.includes('restoreRecoveryBundle.js'));

// Scheduled retention is always analysis/dry-run only, enforced again inside
// the canonical runner so direct invocation cannot inherit destructive flags.
assert.ok(scheduledBat.includes('RECOVERY_RETENTION_APPLY=false'));
assert.ok(scheduledBat.includes('RECOVERY_R2_RETENTION_APPLY=false'));
assert.ok(consolidated.includes("RECOVERY_RETENTION_APPLY: 'false'"));
assert.ok(consolidated.includes("RECOVERY_R2_RETENTION_APPLY: 'false'"));
assert.ok(consolidated.includes('env: { ...process.env, ...envOverrides }'));
assert.ok(consolidated.includes('logger, BACKUP_SAFE_ENV'));
assert.ok(consolidated.includes("step.retentionMode = 'DRY_RUN_ENFORCED'"));

// The report model must expose exactly one workflow with ordered recovery
// stages. Legacy workflowA/workflowB report fields are forbidden.
assert.ok(consolidated.includes("BACKUP_PIPELINE: 'BACKUP_PIPELINE'"));
assert.ok(consolidated.includes("RECOVERY_CAPTURE: 'RECOVERY_CAPTURE'"));
assert.ok(consolidated.includes("RECOVERY_RESTORE: 'RECOVERY_RESTORE'"));
assert.ok(consolidated.includes("FINAL_REPORT: 'FINAL_REPORT'"));
assert.ok(consolidated.includes('workflow: {'));
assert.ok(consolidated.includes('steps: {'));
assert.ok(!consolidated.includes('workflowA'));
assert.ok(!consolidated.includes('workflowB'));

// jobRunner is now an internal component of BACKUP_PIPELINE, not an independent
// scheduled workflow. Its legacy standby path is explicitly disabled.
assert.ok(consolidated.includes("'recovery/jobRunner.js'"));
assert.ok(consolidated.includes("'--backup-workflow'"));
assert.ok(consolidated.includes("'--upload'"));
assert.ok(consolidated.includes("'--retention'"));
assert.ok(consolidated.includes("'--no-standby-restore'"));
assert.ok(jobRunner.includes("const WORKFLOW_STEPS = ['HEALTH_CHECK','BACKUP','VERIFY_BACKUP','UPLOAD','R2_RETENTION','RETENTION','RESTORE_RECOVERY','VERIFY_RECOVERY','REPORT']"));

// Recovery capture and restore are subsequent steps of the same workflow.
assert.ok(consolidated.includes("RECOVERY_STANDBY_SYNC_ENABLED || 'false'"));
assert.ok(consolidated.includes('runRecoveryCapture'));
assert.ok(consolidated.includes('runRecoveryRestore'));
assert.ok(consolidated.includes("'recovery/captureRecoveryBundle.js'"));
assert.ok(consolidated.includes("'recovery/restoreRecoveryBundle.js'"));
assert.ok(captureBundle.includes('REPEATABLE READ READ ONLY'));
assert.ok(captureBundle.includes('--schema=public'));
assert.ok(captureBundle.includes('--schema=legacy_tax'));

// Destructive Recovery DB writes retain explicit approvals and the independent
// Test Database Authority fence.
assert.ok(consolidated.includes('RECOVERY_DRILL_APPROVAL'));
assert.ok(consolidated.includes('ALPHATECH_RECOVERY_DRILL'));
assert.ok(consolidated.includes('RESTORE_DATABASE_RESET_CONFIRMATION'));
assert.ok(consolidated.includes('ALPHATECH_TEST_DB_RESET'));
assert.ok(restoreBundle.includes('assertTestDatabaseAuthority'));
assert.ok(restoreBundle.includes('RESTORE_DATABASE_RESET_CONFIRMATION'));
assert.ok(!/process\.env\.DATABASE_URL\b/.test(restoreBundle));

assert.ok(consolidated.includes('shell: false'));
assert.ok(consolidated.includes('RESTORE_DATABASE_URL|RECOVERY_DATABASE_URL'));

console.log('recovery single workflow contract: PASS');
