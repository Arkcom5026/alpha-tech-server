// recovery/scheduler/recoveryScheduler.js
// AlphaTech Recovery Toolkit — Phase 4.2 Scheduler
//
// Mission:
// Trigger Recovery Jobs on a schedule without coupling to the host machine.
// This is intentionally a lightweight scheduler wrapper.
// It creates a queued job file, then invokes jobRunner.js.
//
// Usage:
//   node recovery/scheduler/recoveryScheduler.js --run-once
//   node recovery/scheduler/recoveryScheduler.js --daemon
//
// Env:
//   RECOVERY_SCHEDULE_HOURS=6
//   RECOVERY_SCHEDULE_MODE=backup-only | backup-and-verify | full-drill
//
// Recommended for Windows Task Scheduler:
//   Run every 6 hours:
//   node recovery/scheduler/recoveryScheduler.js --run-once

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT_DIR = process.cwd();
const RECOVERY_DIR = path.join(ROOT_DIR, 'recovery');
const QUEUE_DIR = path.join(RECOVERY_DIR, 'queue');
const STATE_DIR = path.join(RECOVERY_DIR, 'state');
const LOG_DIR = path.join(RECOVERY_DIR, 'logs');

const SCHEDULER_VERSION = 'ALPHATECH-RECOVERY-SCHEDULER-V1';
const DEFAULT_HOURS = Number(process.env.RECOVERY_SCHEDULE_HOURS || 6);
const DEFAULT_MODE = process.env.RECOVERY_SCHEDULE_MODE || 'backup-only';

function nowIso() {
  return new Date().toISOString();
}

function safeIdFromIso(iso) {
  return iso.replace(/[:.]/g, '-');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function log(message) {
  ensureDir(LOG_DIR);
  const line = `[${nowIso()}] ${message}`;
  console.log(line);
  fs.appendFileSync(path.join(LOG_DIR, 'scheduler.log'), `${line}\n`, 'utf8');
}

function parseArgs(argv) {
  return {
    runOnce: argv.includes('--run-once'),
    daemon: argv.includes('--daemon'),
    mode: getArgValue(argv, '--mode') || DEFAULT_MODE,
  };
}

function getArgValue(argv, key) {
  const index = argv.indexOf(key);
  if (index === -1) return null;
  return argv[index + 1] || null;
}

function updateState(statePatch) {
  ensureDir(STATE_DIR);
  const stateFile = path.join(STATE_DIR, 'recovery-state.json');
  let state = {};
  if (fs.existsSync(stateFile)) {
    try {
      state = readJson(stateFile);
    } catch (_) {
      state = {};
    }
  }

  const next = {
    ...state,
    ...statePatch,
    updatedAt: nowIso(),
  };

  writeJson(stateFile, next);
  return next;
}

function createQueuedJob({ mode, source }) {
  ensureDir(QUEUE_DIR);

  const createdAt = nowIso();
  const jobId = safeIdFromIso(createdAt);
  const queueFile = path.join(QUEUE_DIR, `queued-job-${jobId}.json`);

  const job = {
    queueVersion: SCHEDULER_VERSION,
    jobId,
    source,
    mode,
    status: 'QUEUED',
    createdAt,
    pickedAt: null,
    finishedAt: null,
  };

  writeJson(queueFile, job);
  log(`🧾 Queued job created: ${queueFile}`);
  return { job, queueFile };
}

function runJobRunner(mode) {
  return new Promise((resolve) => {
    const modeArg =
      mode === 'full-drill'
        ? '--full-drill'
        : mode === 'backup-and-verify'
          ? '--backup-and-verify'
          : '--backup-only';

    log(`▶️  Starting jobRunner: node recovery/jobRunner.js ${modeArg}`);

    updateState({
      state: 'JOB_RUNNING',
      activeMode: mode,
      lastStartedAt: nowIso(),
    });

    const child = spawn('node', ['recovery/jobRunner.js', modeArg], {
      cwd: ROOT_DIR,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk) => {
      for (const line of chunk.toString().split(/\r?\n/).filter(Boolean)) {
        log(`jobRunner: ${line}`);
      }
    });

    child.stderr.on('data', (chunk) => {
      for (const line of chunk.toString().split(/\r?\n/).filter(Boolean)) {
        log(`jobRunner stderr: ${line}`);
      }
    });

    child.on('close', (code) => {
      const ok = code === 0;
      updateState({
        state: ok ? 'SUCCESS' : 'FAILED',
        activeMode: mode,
        lastFinishedAt: nowIso(),
        lastExitCode: code,
      });

      log(`${ok ? '✅' : '❌'} jobRunner finished with exitCode=${code}`);
      resolve({ ok, exitCode: code });
    });

    child.on('error', (error) => {
      updateState({
        state: 'FAILED',
        activeMode: mode,
        lastFinishedAt: nowIso(),
        lastExitCode: 1,
        lastError: error.message || String(error),
      });

      log(`❌ jobRunner failed to start: ${error.message || error}`);
      resolve({ ok: false, exitCode: 1, error: error.message || String(error) });
    });
  });
}

async function runOnce(mode, source = 'manual-run-once') {
  ensureDir(QUEUE_DIR);
  ensureDir(STATE_DIR);
  ensureDir(LOG_DIR);

  log('============================================================');
  log(`⏱️ AlphaTech Recovery Scheduler ${SCHEDULER_VERSION}`);
  log('============================================================');
  log(`Mode: ${mode}`);

  updateState({
    state: 'QUEUED',
    activeMode: mode,
    lastQueuedAt: nowIso(),
  });

  createQueuedJob({ mode, source });

  const result = await runJobRunner(mode);
  process.exitCode = result.exitCode;
}

async function runDaemon(mode) {
  const intervalMs = Math.max(1, DEFAULT_HOURS) * 60 * 60 * 1000;

  log('============================================================');
  log(`⏱️ AlphaTech Recovery Scheduler Daemon ${SCHEDULER_VERSION}`);
  log('============================================================');
  log(`Mode: ${mode}`);
  log(`Interval hours: ${DEFAULT_HOURS}`);

  await runOnce(mode, 'daemon-start');

  setInterval(() => {
    runOnce(mode, 'daemon-interval').catch((error) => {
      log(`❌ daemon interval failed: ${error.stack || error.message || String(error)}`);
    });
  }, intervalMs);
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.runOnce && !args.daemon) {
    console.log(`
AlphaTech Recovery Scheduler

Usage:
  node recovery/scheduler/recoveryScheduler.js --run-once
  node recovery/scheduler/recoveryScheduler.js --run-once --mode backup-and-verify
  node recovery/scheduler/recoveryScheduler.js --daemon --mode backup-only

Modes:
  backup-only
  backup-and-verify
  full-drill
`);
    return;
  }

  if (!['backup-only', 'backup-and-verify', 'full-drill'].includes(args.mode)) {
    throw new Error(`Invalid mode: ${args.mode}`);
  }

  if (args.runOnce) {
    await runOnce(args.mode);
    return;
  }

  if (args.daemon) {
    await runDaemon(args.mode);
  }
}

main().catch((error) => {
  log(`❌ Scheduler failed: ${error.stack || error.message || String(error)}`);
  updateState({
    state: 'FAILED',
    lastFinishedAt: nowIso(),
    lastExitCode: 1,
    lastError: error.message || String(error),
  });
  process.exitCode = 1;
});
