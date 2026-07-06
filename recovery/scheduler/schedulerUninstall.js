// recovery/scheduler/schedulerUninstall.js
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = process.cwd();
const TASK_NAME = process.env.RECOVERY_TASK_NAME || 'AlphaTech Recovery Workflow';
const HISTORY_DIR = path.join(ROOT_DIR, 'recovery', 'scheduler', 'history');

function nowIso() { return new Date().toISOString(); }
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }

function writeHistory(event) {
  ensureDir(HISTORY_DIR);
  const historyFile = path.join(HISTORY_DIR, 'scheduler-history.json');
  let history = [];
  if (fs.existsSync(historyFile)) {
    try { history = JSON.parse(fs.readFileSync(historyFile, 'utf8')); } catch (_) { history = []; }
  }
  history.push(Object.assign({ at: nowIso() }, event));
  fs.writeFileSync(historyFile, JSON.stringify(history.slice(-500), null, 2), 'utf8');
}

const result = spawnSync('schtasks.exe', ['/Delete', '/TN', TASK_NAME, '/F'], {
  cwd: ROOT_DIR,
  shell: false,
  encoding: 'utf8',
});

console.log(result.stdout || '');
if (result.stderr) console.error(result.stderr);

const ok = result.status === 0;
writeHistory({ event: 'UNINSTALL', taskName: TASK_NAME, ok, exitCode: result.status });
if (!ok) process.exitCode = result.status || 1;
