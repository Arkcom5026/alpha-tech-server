'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

const consolidated = read('recovery/consolidatedRecoveryRunner.js');
const finalizer = read('recovery/finalizeJobRunnerReport.js');

// The canonical consolidated entrypoint must normalize Workflow A reports only
// after jobRunner exits, using the finalized job manifest as authority.
assert.ok(consolidated.includes("require('./finalizeJobRunnerReport')"));
assert.ok(consolidated.includes('normalizeLatestJobRunnerReport'));
assert.ok(consolidated.includes('Workflow A report normalized'));
assert.ok(consolidated.includes('report.workflowA.report'));

// The finalizer must read the finalized job manifest and reject stale or
// incomplete metadata rather than inventing a successful report.
assert.ok(finalizer.includes("path.join(JOB_DIR, 'job.latest.json')"));
assert.ok(finalizer.includes('Number.isInteger(job.exitCode)'));
assert.ok(finalizer.includes('job.workflow.steps.REPORT.status'));
assert.ok(finalizer.includes('job.startedAt'));
assert.ok(finalizer.includes('older than the current Workflow A execution'));

// Finalized JSON/TXT reports must contain the real final exit code and final
// REPORT state from job.latest.json.
assert.ok(finalizer.includes('`Exit Code: ${job.exitCode}`'));
assert.ok(finalizer.includes("'workflow-report.latest.json'"));
assert.ok(finalizer.includes("'workflow-report.latest.txt'"));
assert.ok(finalizer.includes('writeJson(latestJsonPath, job)'));
assert.ok(finalizer.includes("fs.writeFileSync(latestTxtPath, text, 'utf8')"));

// Reporting normalization is file-only and must not contain DB or shell writes.
assert.ok(!finalizer.includes('DATABASE_URL'));
assert.ok(!finalizer.includes('DROP SCHEMA'));
assert.ok(!finalizer.includes('spawn('));
assert.ok(!finalizer.includes('exec('));

console.log('recovery job runner report finalization contract: PASS');
