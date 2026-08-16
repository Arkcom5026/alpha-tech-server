'use strict';

// AlphaTech consolidated Recovery workflow.
//
// Authority model:
//   Workflow A remains mandatory and canonical for health/backup/verify/upload/
//   retention through recovery/jobRunner.js.
//   Workflow B (PostgreSQL Production -> Recovery/Standby clone) is an optional
//   post-backup stage owned by this same scheduled execution. It is disabled by
//   default and remains behind explicit destructive-write approvals.
//
// Default scheduled behavior is intentionally unchanged:
//   node recovery/consolidatedRecoveryRunner.js
//     -> jobRunner.js --backup-workflow --upload --retention
//     -> standby sync SKIPPED unless RECOVERY_STANDBY_SYNC_ENABLED=true

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT_DIR = process.cwd();
const RECOVERY_DIR = path.join(ROOT_DIR, 'recovery');
const REPORT_DIR = path.join(RECOVERY_DIR, 'reports');
const LOG_DIR = path.join(RECOVERY_DIR, 'logs');
const BACKUPS_DIR = process.env.BACKUP_OUTPUT_DIR || path.join(ROOT_DIR, 'backups');

const RUNNER_VERSION = 'ALPHATECH-CONSOLIDATED-RECOVERY-RUNNER-V1';
const STANDBY_SYNC_ENABLED = String(process.env.RECOVERY_STANDBY_SYNC_ENABLED || 'false').toLowerCase() === 'true';
const DRILL_APPROVAL = 'ALPHATECH_RECOVERY_DRILL';
const RESET_CONFIRMATION = 'ALPHATECH_TEST_DB_RESET';

function nowIso() { return new Date().toISOString(); }
function safeId(value) { return value.replace(/[:.]/g, '-'); }
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function writeJson(filePath, value) { fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8'); }
function redact(value) {
  return String(value || '')
    .replace(/(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+@/gi, '$1***@')
    .replace(/(DATABASE_URL|DIRECT_URL|RESTORE_DATABASE_URL|RECOVERY_DATABASE_URL|S3_SECRET_ACCESS_KEY|R2_SECRET_ACCESS_KEY)\s*[=:]\s*[^\s]+/gi, '$1=[HIDDEN]');
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

function run(command, args, logger) {
  return new Promise((resolve) => {
    logger.log(`▶️ Run: ${command} ${args.join(' ')}`);
    const child = spawn(command, args, {
      cwd: ROOT_DIR,
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

function requireStandbyApprovals() {
  if (process.env.RECOVERY_DRILL_APPROVAL !== DRILL_APPROVAL) {
    throw new Error(`RECOVERY_DRILL_APPROVAL must equal ${DRILL_APPROVAL} before standby sync.`);
  }
  if (process.env.RESTORE_DATABASE_RESET_CONFIRMATION !== RESET_CONFIRMATION) {
    throw new Error(`RESTORE_DATABASE_RESET_CONFIRMATION must equal ${RESET_CONFIRMATION} before standby sync.`);
  }
  if (!String(process.env.RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL || '').trim()) {
    throw new Error('RESTORE_DATABASE_URL or RECOVERY_DATABASE_URL is required before standby sync.');
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

async function runWorkflowA(report, logger) {
  report.workflowA.status = 'RUNNING';
  report.workflowA.startedAt = nowIso();
  const result = await run(process.execPath, [
    'recovery/jobRunner.js',
    '--backup-workflow',
    '--upload',
    '--retention',
    '--no-standby-restore',
  ], logger);
  report.workflowA.finishedAt = nowIso();
  report.workflowA.exitCode = result.exitCode;
  report.workflowA.status = result.ok ? 'PASS' : 'FAIL';
  report.workflowA.error = result.error || null;
  return result;
}

async function runWorkflowB(report, logger) {
  if (!STANDBY_SYNC_ENABLED) {
    report.workflowB.status = 'SKIPPED';
    report.workflowB.reason = 'RECOVERY_STANDBY_SYNC_ENABLED is not true';
    logger.log('⏭️ Standby sync skipped: RECOVERY_STANDBY_SYNC_ENABLED is not true.');
    return { ok: true, skipped: true, exitCode: 0 };
  }

  requireStandbyApprovals();
  report.workflowB.status = 'RUNNING';
  report.workflowB.startedAt = nowIso();

  const captureStartedMs = Date.now();
  const capture = await run(process.execPath, ['recovery/captureRecoveryBundle.js'], logger);
  report.workflowB.capture = {
    status: capture.ok ? 'PASS' : 'FAIL',
    exitCode: capture.exitCode,
    error: capture.error || null,
  };
  if (!capture.ok) {
    report.workflowB.status = 'FAIL';
    report.workflowB.finishedAt = nowIso();
    report.workflowB.error = 'Recovery bundle capture failed';
    return capture;
  }

  const latest = latestRecoveryBundleManifest({ afterMs: captureStartedMs - 5000 });
  if (!latest) {
    report.workflowB.status = 'FAIL';
    report.workflowB.finishedAt = nowIso();
    report.workflowB.error = 'New recovery bundle manifest not found after capture';
    return { ok: false, exitCode: 31, error: report.workflowB.error };
  }

  report.workflowB.manifestPath = latest.filePath;
  const restore = await run(process.execPath, [
    'recovery/restoreRecoveryBundle.js',
    '--manifest', latest.filePath,
    '--yes',
  ], logger);
  report.workflowB.restore = {
    status: restore.ok ? 'PASS' : 'FAIL',
    exitCode: restore.exitCode,
    error: restore.error || null,
  };
  report.workflowB.finishedAt = nowIso();
  report.workflowB.status = restore.ok ? 'PASS' : 'FAIL';
  report.workflowB.error = restore.error || null;
  return restore;
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
    standbySyncEnabled: STANDBY_SYNC_ENABLED,
    workflowA: { status: 'PENDING' },
    workflowB: { status: 'PENDING' },
  };

  let exitCode = 0;
  try {
    logger.log('============================================================');
    logger.log(`🧭 AlphaTech Consolidated Recovery ${RUNNER_VERSION}`);
    logger.log('============================================================');

    const workflowA = await runWorkflowA(report, logger);
    if (!workflowA.ok) {
      exitCode = 10;
      return;
    }

    const workflowB = await runWorkflowB(report, logger);
    if (!workflowB.ok) {
      exitCode = 20;
      return;
    }
  } catch (error) {
    exitCode = 1;
    report.error = redact(error.stack || error.message || String(error));
    logger.log(`❌ Consolidated recovery failed: ${report.error}`);
  } finally {
    report.finishedAt = nowIso();
    report.exitCode = exitCode;
    report.ok = exitCode === 0;
    const jsonPath = path.join(REPORT_DIR, `consolidated-workflow-${runId}.json`);
    const latestPath = path.join(REPORT_DIR, 'consolidated-workflow.latest.json');
    writeJson(jsonPath, report);
    writeJson(latestPath, report);
    logger.log(`🧾 Consolidated report: ${jsonPath}`);
    logger.log(`${report.ok ? '✅' : '❌'} Consolidated result: ${report.ok ? 'PASS' : 'FAIL'} exitCode=${exitCode}`);
    process.exitCode = exitCode;
  }
}

main();
