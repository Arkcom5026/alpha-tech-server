// recovery/scheduler/schedulerInstaller.js
// AlphaTech Recovery Toolkit - Phase 8 Scheduler Installer Hotfix v2
// Uses Windows Task Scheduler XML to avoid quoting issues with spaces.

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT_DIR = process.cwd();
const TASK_NAME = process.env.RECOVERY_TASK_NAME || 'AlphaTech Recovery Workflow';
const INTERVAL_HOURS = Number(process.env.RECOVERY_TASK_INTERVAL_HOURS || process.env.RECOVERY_SCHEDULE_HOURS || 6);
const TASK_SCRIPT = process.env.RECOVERY_TASK_SCRIPT || 'scripts\\run-recovery-task.bat';
const LOG_DIR = path.join(ROOT_DIR, 'recovery', 'logs');
const HISTORY_DIR = path.join(ROOT_DIR, 'recovery', 'scheduler', 'history');
const XML_PATH = path.join(ROOT_DIR, 'recovery', 'scheduler', 'alphatech-recovery-task.xml');

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function log(message) {
  ensureDir(LOG_DIR);
  const line = '[' + nowIso() + '] ' + message;
  console.log(line);
  fs.appendFileSync(path.join(LOG_DIR, 'scheduler-install.log'), line + '\n', 'utf8');
}

function writeHistory(event) {
  ensureDir(HISTORY_DIR);
  const historyFile = path.join(HISTORY_DIR, 'scheduler-history.json');
  let history = [];

  if (fs.existsSync(historyFile)) {
    try {
      history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
    } catch (_error) {
      history = [];
    }
  }

  history.push(Object.assign({ at: nowIso() }, event));
  fs.writeFileSync(historyFile, JSON.stringify(history.slice(-500), null, 2), 'utf8');
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    shell: false,
    encoding: 'utf8',
  });

  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    ok: result.status === 0,
  };
}

function taskExists() {
  const result = run('schtasks.exe', ['/Query', '/TN', TASK_NAME]);
  return result.ok;
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function writeTaskXml(scriptPath) {
  const startBoundary = new Date(Date.now() + 2 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, '');
  const interval = 'PT' + INTERVAL_HOURS + 'H';

  const xml = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>AlphaTech Recovery Workflow: Health, Backup, Verify, Upload, Retention</Description>
  </RegistrationInfo>
  <Triggers>
    <TimeTrigger>
      <StartBoundary>${xmlEscape(startBoundary)}</StartBoundary>
      <Enabled>true</Enabled>
      <Repetition>
        <Interval>${xmlEscape(interval)}</Interval>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
    </TimeTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>true</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT2H</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>cmd.exe</Command>
      <Arguments>/c "${xmlEscape(scriptPath)}"</Arguments>
      <WorkingDirectory>${xmlEscape(ROOT_DIR)}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
`;

  // Task Scheduler XML expects UTF-16LE well.
  fs.writeFileSync(XML_PATH, '\ufeff' + xml, 'utf16le');
  return XML_PATH;
}

function main() {
  ensureDir(LOG_DIR);
  ensureDir(HISTORY_DIR);
  ensureDir(path.dirname(XML_PATH));

  log('============================================================');
  log('AlphaTech Recovery Scheduler Installer v2 XML');
  log('============================================================');

  if (process.platform !== 'win32') {
    throw new Error('This installer is for Windows Task Scheduler only.');
  }

  const scriptPath = path.join(ROOT_DIR, TASK_SCRIPT);
  if (!fs.existsSync(scriptPath)) {
    throw new Error('Task script not found: ' + scriptPath);
  }

  if (taskExists()) {
    log('Existing task found. Deleting first: ' + TASK_NAME);
    const del = run('schtasks.exe', ['/Delete', '/TN', TASK_NAME, '/F']);
    if (!del.ok) {
      throw new Error('Failed to delete existing task: ' + (del.stderr || del.stdout));
    }
  }

  const xmlPath = writeTaskXml(scriptPath);

  log('Creating task from XML: ' + TASK_NAME);
  log('Interval hours: ' + INTERVAL_HOURS);
  log('Task script: ' + scriptPath);
  log('Task XML: ' + xmlPath);

  const result = run('schtasks.exe', ['/Create', '/TN', TASK_NAME, '/XML', xmlPath, '/F']);

  if (!result.ok) {
    throw new Error('schtasks create failed: ' + (result.stderr || result.stdout));
  }

  log((result.stdout || '').trim());
  log('Scheduler installed successfully.');

  writeHistory({
    event: 'INSTALL',
    taskName: TASK_NAME,
    intervalHours: INTERVAL_HOURS,
    taskScript: TASK_SCRIPT,
    xmlPath,
    ok: true,
  });
}

try {
  main();
} catch (error) {
  log('Install failed: ' + (error.stack || error.message || String(error)));
  writeHistory({
    event: 'INSTALL',
    taskName: TASK_NAME,
    ok: false,
    error: error.message || String(error),
  });
  process.exitCode = 1;
}
