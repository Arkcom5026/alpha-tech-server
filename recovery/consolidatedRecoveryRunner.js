'use strict';

// AlphaTech canonical Recovery workflow.
//
// One scheduled execution owns the complete recovery chain:
//   BACKUP_PIPELINE -> RECOVERY_CAPTURE -> RECOVERY_RESTORE -> FINAL_REPORT
//
// recovery/jobRunner.js remains an internal backup/verify/upload/retention
// component. It is not a separately scheduled workflow. Recovery capture and
// restore are subsequent steps of this same canonical workflow.
//
// Safety rules:
//   - scheduled/local/R2 retention is forced to dry-run by this authority;
//   - Production capture remains read-only;
//   - Recovery restore requires explicit Test/Recovery approvals and the
//     independent Test Database Authority fence in restoreRecoveryBundle.js;
//   - direct invocation is safe-by-default because Recovery DB sync is disabled
//     unless RECOVERY_STANDBY_SYNC_ENABLED=true.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { normalizeLatestJobRunnerReport } = require('./finalizeJobRunnerReport');

require('dotenv').config();
const RESTORE_ENV_PATH = path.join(process.cwd(), '.env.restore');
const RECOVERY_ENV_PATH = path.join(process.cwd(), '.env.recovery');
if (fs.existsSync(RESTORE_ENV_PATH)) {
  require('dotenv').config({ path: RESTORE_ENV_PATH, override: false });
}
if (fs.existsSync(RECOVERY_ENV_PATH)) {
  require('dotenv').config({ path: RECOVERY_ENV_PATH, override: false });
}

const ROOT_DIR = process.cwd();
const RECOVERY_DIR = path.join(ROOT_DIR, 'recovery');
const REPORT_DIR = path.join(RECOVERY_DIR, 'reports');
const LOG_DIR = path.join(RECOVERY_DIR, 'logs');
const BACKUPS_DIR = process.env.BACKUP_OUTPUT_DIR || path.join(ROOT_DIR, 'backups');

const RUNNER_VERSION = 'ALPHATECH-RECOVERY-WORKFLOW-V2';
const RECOVERY_SYNC_ENABLED = String(process.env.RECOVERY_STANDBY_SYNC_ENABLED || 'false').toLowerCase() === 'true';
const DRILL_APPROVAL = 'ALPHATECH_RECOVERY_DRILL';
const RESET_CONFIRMATION = 'ALPHATECH_TEST_DB_RESET';
const BACKUP_SAFE_ENV = Object.freeze({
  RECOVERY_RETENTION_APPLY: 'false',
  RECOVERY_R2_RETENTION_APPLY: 'false',
});

const STEP = Object.freeze({
  BACKUP_PIPELINE: 'BACKUP_PIPELINE',
  RECOVERY_CAPTURE: 'RECOVERY_CAPTURE',
  RECOVERY_RESTORE: 'RECOVERY_RESTORE',
  FINAL_REPORT: 'FINAL_REPORT',
});

function nowIso() { return new Date().toISOString(); }
function safeId(value) { return value.replace(/[:.]/g, '-'); }
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function writeJson(filePath, value) { fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8'); }
function redact(value) {
  return String(value || '')
    .replace(/(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+@/gi, '$1***@')
    .replace(/(DATABASE_URL|DIRECT_URL|RESTORE_DATABASE_URL|RECOVERY_DATABASE_URL|S3_SECRET_ACCESS_KEY|R2_SECRET_ACCESS_KEY)\s*[=:]\s*[^\s]+/gi, '$1=[HIDDEN]');
}

function initialStep(name) {
  return { name, status: 'PENDING', startedAt: null, finishedAt: null, exitCode: null, error: null };
}

function startStep(report, name) {
  const step = report.workflow.steps[name];
  step.status = 'RUNNING';
  step.startedAt = nowIso();
  return step;
}

function finishStep(report, name, { ok, exitCode = ok ? 0 : 1, error = null, details = {} }) {
  const step = report.workflow.steps[name];
  step.finishedAt = nowIso();
  step.exitCode = exitCode;
  step.status = ok ? 'PASS' : 'FAIL';
  step.error = error;
  Object.assign(step, details);
  return step;
}

function skipStep(report, name, reason) {
  const step = report.workflow.steps[name];
  step.status = 'SKIPPED';
  step.finishedAt = nowIso();
  step.reason = reason;
  return step;
}

function createLogger(runId) {
  ensureDir(LOG_DIR);
  const logFile = path.join(LOG_DIR, `consolidated-${runId}.log`);
  const log = (message) => {
    const line = `[${nowIso()}] ${message}`;
    console.log(line);
    fs.appendFileSync(logFile, `${line}\n`, 'utf8');
  };
  return { log, logFile };
}

function run(command, args, logger, envOverrides = {}) {
  return new Promise((resolve) => {
    logger.log(`▶️ Run: ${command} ${args.join(' ')}`);
    const child = spawn(command, args, {
      cwd: ROOT_DIR,
      env: { ...process.env, ...envOverrides },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => {
      for (const line of chunk.toString().split(/\r?\n/).filter(Boolean)) {
        logger.log(`${command}: ${redact(line)}`);
      }
    });
    child.stderr.on('data', (chunk) => {
      for (const line of chunk.toString().split(/\r?\n/).filter(Boolean)) {
        logger.log(`${command} stderr: ${redact(line)}`);
      }
    });
    child.on('error', (error) => resolve({ ok: false, exitCode: 1, error: redact(error.message || String(error)) }));
    child.on('close', (code) => resolve({ ok: code === 0, exitCode: code }));
  });
}

function requireRecoverySyncApprovals() {
  if (process.env.RECOVERY_DRILL_APPROVAL !== DRILL_APPROVAL) {
    throw new Error(`RECOVERY_DRILL_APPROVAL must equal ${DRILL_APPROVAL} before Recovery DB sync.`);
  }
  if (process.env.RESTORE_DATABASE_RESET_CONFIRMATION !== RESET_CONFIRMATION) {
    throw new Error(`RESTORE_DATABASE_RESET_CONFIRMATION must equal ${RESET_CONFIRMATION} before Recovery DB sync.`);
  }
  if (!String(process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL || '').trim()) {
    throw new Error('RESTORE_DATABASE_URL or RECOVERY_DATABASE_URL is required before Recovery DB sync.');
  }
}

function latestRecoveryBundleManifest({ afterMs = 0 } = {}) {
  if (!fs.existsSync(BACKUPS_DIR)) return null;
  return fs.readdirSync(BACKUPS_DIR)
    .filter((name) => /^alphatech_recovery_bundle_.*\.manifest\.json$/.test(name))
    .map((name) => {
      const filePath = path.join(BACKUPS_DIR, name);
      return { filePath, mtimeMs: fs.statSync(filePath).mtimeMs };
    })
    .filter((entry) => entry.mtimeMs >= afterMs)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0] || null;
}

async function runBackupPipeline(report, logger) {
  const step = startStep(report, STEP.BACKUP_PIPELINE);
  step.retentionMode = 'DRY_RUN_ENFORCED';

  const result = await run(process.execPath, [
    'recovery/jobRunner.js',
    '--backup-workflow',
    '--upload',
    '--retention',
    '--no-standby-restore',
  ], logger, BACKUP_SAFE_ENV);

  try {
    const normalized = normalizeLatestJobRunnerReport({ expectedStartedAt: step.startedAt });
    step.report = {
      status: 'PASS',
      jobId: normalized.jobId,
      reportStatus: normalized.reportStatus,
      exitCode: normalized.exitCode,
      latestJsonPath: normalized.latestJsonPath,
      latestTxtPath: normalized.latestTxtPath,
    };
    logger.log(`🧾 Backup pipeline report normalized: REPORT=${normalized.reportStatus} exitCode=${normalized.exitCode}`);
  } catch (error) {
    const message = redact(error.stack || error.message || String(error));
    step.report = { status: 'FAIL', error: message };
    finishStep(report, STEP.BACKUP_PIPELINE, {
      ok: false,
      exitCode: 12,
      error: `Backup pipeline report normalization failed: ${message}`,
    });
    return { ok: false, exitCode: 12, error: step.error };
  }

  finishStep(report, STEP.BACKUP_PIPELINE, {
    ok: result.ok,
    exitCode: result.exitCode,
    error: result.error || null,
  });
  return result;
}

async function runRecoveryCapture(report, logger) {
  if (!RECOVERY_SYNC_ENABLED) {
    skipStep(report, STEP.RECOVERY_CAPTURE, 'RECOVERY_STANDBY_SYNC_ENABLED is not true');
    skipStep(report, STEP.RECOVERY_RESTORE, 'Recovery capture is disabled');
    logger.log('⏭️ Recovery DB sync skipped: RECOVERY_STANDBY_SYNC_ENABLED is not true.');
    return { ok: true, skipped: true, exitCode: 0 };
  }

  requireRecoverySyncApprovals();
  startStep(report, STEP.RECOVERY_CAPTURE);
  const captureStartedMs = Date.now();
  const result = await run(process.execPath, ['recovery/captureRecoveryBundle.js'], logger);

  if (!result.ok) {
    finishStep(report, STEP.RECOVERY_CAPTURE, {
      ok: false,
      exitCode: result.exitCode,
      error: result.error || 'Recovery bundle capture failed',
    });
    skipStep(report, STEP.RECOVERY_RESTORE, 'Recovery capture failed');
    return result;
  }

  const latest = latestRecoveryBundleManifest({ afterMs: captureStartedMs - 5000 });
  if (!latest) {
    finishStep(report, STEP.RECOVERY_CAPTURE, {
      ok: false,
      exitCode: 31,
      error: 'New recovery bundle manifest not found after capture',
    });
    skipStep(report, STEP.RECOVERY_RESTORE, 'Recovery bundle manifest missing');
    return { ok: false, exitCode: 31, error: report.workflow.steps[STEP.RECOVERY_CAPTURE].error };
  }

  finishStep(report, STEP.RECOVERY_CAPTURE, {
    ok: true,
    exitCode: 0,
    details: { manifestPath: latest.filePath },
  });
  return { ok: true, exitCode: 0, manifestPath: latest.filePath };
}

async function runRecoveryRestore(report, logger, manifestPath) {
  if (!RECOVERY_SYNC_ENABLED) return { ok: true, skipped: true, exitCode: 0 };

  startStep(report, STEP.RECOVERY_RESTORE);
  const result = await run(process.execPath, [
    'recovery/restoreRecoveryBundle.js',
    '--manifest', manifestPath,
    '--yes',
  ], logger);

  finishStep(report, STEP.RECOVERY_RESTORE, {
    ok: result.ok,
    exitCode: result.exitCode,
    error: result.error || null,
    details: { manifestPath },
  });
  return result;
}

async function main() {
  ensureDir(REPORT_DIR);
  ensureDir(LOG_DIR);
  const startedAt = nowIso();
  const runId = safeId(startedAt);
  const logger = createLogger(runId);
  const report = {
    runnerVersion: RUNNER_VERSION,
    runId,
    startedAt,
    finishedAt: null,
    ok: false,
    recoverySyncEnabled: RECOVERY_SYNC_ENABLED,
    workflow: {
      status: 'RUNNING',
      steps: {
        [STEP.BACKUP_PIPELINE]: initialStep(STEP.BACKUP_PIPELINE),
        [STEP.RECOVERY_CAPTURE]: initialStep(STEP.RECOVERY_CAPTURE),
        [STEP.RECOVERY_RESTORE]: initialStep(STEP.RECOVERY_RESTORE),
        [STEP.FINAL_REPORT]: initialStep(STEP.FINAL_REPORT),
      },
    },
  };

  let exitCode = 0;
  try {
    logger.log('============================================================');
    logger.log(`🧭 AlphaTech Recovery Workflow ${RUNNER_VERSION}`);
    logger.log('============================================================');

    const backup = await runBackupPipeline(report, logger);
    if (!backup.ok) {
      skipStep(report, STEP.RECOVERY_CAPTURE, 'Backup pipeline failed');
      skipStep(report, STEP.RECOVERY_RESTORE, 'Backup pipeline failed');
      exitCode = 10;
      return;
    }

    const capture = await runRecoveryCapture(report, logger);
    if (!capture.ok) {
      exitCode = 20;
      return;
    }

    if (!capture.skipped) {
      const restore = await runRecoveryRestore(report, logger, capture.manifestPath);
      if (!restore.ok) {
        exitCode = 30;
        return;
      }
    }
  } catch (error) {
    exitCode = 1;
    report.error = redact(error.stack || error.message || String(error));
    logger.log(`❌ Recovery workflow failed: ${report.error}`);
  } finally {
    const finalStep = startStep(report, STEP.FINAL_REPORT);
    report.finishedAt = nowIso();
    report.exitCode = exitCode;
    report.ok = exitCode === 0;
    report.workflow.status = report.ok ? 'SUCCESS' : 'FAILED';
    finalStep.finishedAt = nowIso();
    finalStep.exitCode = 0;
    finalStep.status = 'PASS';

    const jsonPath = path.join(REPORT_DIR, `consolidated-workflow-${runId}.json`);
    const latestPath = path.join(REPORT_DIR, 'consolidated-workflow.latest.json');
    writeJson(jsonPath, report);
    writeJson(latestPath, report);
    logger.log(`🧾 Recovery workflow report: ${jsonPath}`);
    logger.log(`${report.ok ? '✅' : '❌'} Recovery workflow result: ${report.ok ? 'PASS' : 'FAIL'} exitCode=${exitCode}`);
    process.exitCode = exitCode;
  }
}

main();
