'use strict';

// Normalize the legacy jobRunner report after the child process has fully
// finalized its job manifest. jobRunner historically writes workflow-report.*
// before REPORT is marked PASS and before the final exitCode is assigned.
// The consolidated recovery runner is the canonical entrypoint, so it rewrites
// the report from job.latest.json only after jobRunner has exited.

const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.cwd();
const RECOVERY_DIR = path.join(ROOT_DIR, 'recovery');
const JOB_DIR = path.join(RECOVERY_DIR, 'jobs');
const REPORT_DIR = path.join(RECOVERY_DIR, 'reports');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function renderReport(job) {
  const lines = [
    '========================================',
    'AlphaTech Recovery Workflow Report',
    '========================================',
    `Job ID     : ${job.jobId}`,
    `Mode       : ${job.mode}`,
    `Overall    : ${job.ok ? 'PASS' : 'FAIL'}`,
    '',
    'Steps',
    '----------------------------------------',
  ];

  for (const step of Object.values(job.workflow?.steps || {})) {
    lines.push(`${step.name.padEnd(18)} ${String(step.status || '').padEnd(8)} ${step.durationMs ?? ''}ms`);
    if (step.error) lines.push(`  error: ${step.error}`);
    if (step.details?.reason) lines.push(`  reason: ${step.details.reason}`);
  }

  lines.push(
    '----------------------------------------',
    `Exit Code: ${job.exitCode}`,
    '========================================',
  );

  return `${lines.join('\n')}\n`;
}

function normalizeLatestJobRunnerReport({ expectedStartedAt = null } = {}) {
  const latestJobPath = path.join(JOB_DIR, 'job.latest.json');
  if (!fs.existsSync(latestJobPath)) {
    throw new Error('recovery/jobs/job.latest.json not found after Workflow A completion');
  }

  const job = readJson(latestJobPath);
  if (!job?.jobId || !job?.workflow?.steps?.REPORT) {
    throw new Error('job.latest.json is missing finalized Workflow A report metadata');
  }
  if (!Number.isInteger(job.exitCode)) {
    throw new Error('job.latest.json does not contain a finalized integer exitCode');
  }
  if (expectedStartedAt && Date.parse(job.startedAt || '') + 5000 < Date.parse(expectedStartedAt)) {
    throw new Error('job.latest.json is older than the current Workflow A execution');
  }

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const jsonPath = path.join(REPORT_DIR, `workflow-report-${job.jobId}.json`);
  const txtPath = path.join(REPORT_DIR, `workflow-report-${job.jobId}.txt`);
  const latestJsonPath = path.join(REPORT_DIR, 'workflow-report.latest.json');
  const latestTxtPath = path.join(REPORT_DIR, 'workflow-report.latest.txt');
  const text = renderReport(job);

  writeJson(jsonPath, job);
  fs.writeFileSync(txtPath, text, 'utf8');
  writeJson(latestJsonPath, job);
  fs.writeFileSync(latestTxtPath, text, 'utf8');

  return {
    jobId: job.jobId,
    exitCode: job.exitCode,
    overall: job.ok ? 'PASS' : 'FAIL',
    reportStatus: job.workflow.steps.REPORT.status,
    latestJsonPath,
    latestTxtPath,
  };
}

module.exports = {
  normalizeLatestJobRunnerReport,
  renderReport,
};
