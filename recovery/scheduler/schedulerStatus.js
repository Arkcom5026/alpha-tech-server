// recovery/scheduler/schedulerStatus.js
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = process.cwd();
const TASK_NAME = process.env.RECOVERY_TASK_NAME || 'AlphaTech Recovery Workflow';
const HISTORY_DIR = path.join(ROOT_DIR, 'recovery', 'scheduler', 'history');
const STATE_FILE = path.join(ROOT_DIR, 'recovery', 'state', 'recovery-state.json');
const JOB_LATEST = path.join(ROOT_DIR, 'recovery', 'jobs', 'job.latest.json');
const WORKFLOW_REPORT = path.join(ROOT_DIR, 'recovery', 'reports', 'workflow-report.latest.json');

function run(command, args) {
  return spawnSync(command, args, { cwd: ROOT_DIR, shell: false, encoding: 'utf8' });
}

function readJsonSafe(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (_) { return null; }
}

function main() {
  console.log('=====================================');
  console.log('AlphaTech Recovery Scheduler Status');
  console.log('=====================================');
  console.log('');

  const query = run('schtasks.exe', ['/Query', '/TN', TASK_NAME]);
  const exists = query.status === 0;

  console.log('Task Name ............ ' + TASK_NAME);
  console.log('Installed ............ ' + (exists ? 'YES' : 'NO'));

  if (exists) {
    const verbose = run('schtasks.exe', ['/Query', '/TN', TASK_NAME, '/V', '/FO', 'LIST']);
    console.log('');
    console.log((verbose.stdout || '').trim());
    if (verbose.stderr) console.error(verbose.stderr);
  } else {
    console.log((query.stderr || query.stdout || '').trim());
  }

  const state = readJsonSafe(STATE_FILE);
  const job = readJsonSafe(JOB_LATEST);
  const report = readJsonSafe(WORKFLOW_REPORT);
  const history = readJsonSafe(path.join(HISTORY_DIR, 'scheduler-history.json')) || [];
  const last = history[history.length - 1];

  console.log('');
  console.log('Latest Recovery State');
  console.log('-------------------------------------');
  console.log('State ................ ' + (state && state.state ? state.state : '(none)'));
  console.log('Updated At ........... ' + (state && state.updatedAt ? state.updatedAt : '(none)'));
  console.log('Last Exit Code ....... ' + (state && state.lastExitCode !== undefined ? state.lastExitCode : '(none)'));

  console.log('');
  console.log('Latest Job');
  console.log('-------------------------------------');
  console.log('Job ID ............... ' + (job && job.jobId ? job.jobId : '(none)'));
  console.log('OK ................... ' + (job ? (job.ok ? 'YES' : 'NO') : '(none)'));
  console.log('Exit Code ............ ' + (job && job.exitCode !== undefined ? job.exitCode : '(none)'));

  console.log('');
  console.log('Latest Workflow Report');
  console.log('-------------------------------------');
  console.log('Overall .............. ' + (report ? (report.ok ? 'PASS' : 'FAIL') : '(none)'));

  console.log('');
  console.log('Scheduler History');
  console.log('-------------------------------------');
  console.log('Events ............... ' + history.length);
  console.log('Last Event ........... ' + (last && last.event ? last.event : '(none)'));
  console.log('Last Event At ........ ' + (last && last.at ? last.at : '(none)'));
}

main();
