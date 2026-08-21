import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(new URL('../.github/workflows/render-log-observability.yml', import.meta.url), 'utf8');

test('Render observability workflow can read the prior artifact without gaining write authority', () => {
  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read\s*\n\s*actions:\s*read/);
  assert.doesNotMatch(workflow, /contents:\s*write/);
  assert.doesNotMatch(workflow, /actions:\s*write/);
});

test('workflow downloads a prior successful snapshot and tolerates an expired baseline artifact', () => {
  assert.match(workflow, /Find previous successful snapshot run/);
  assert.match(workflow, /status:\s*'success'/);
  assert.match(workflow, /Download previous snapshot baseline/);
  assert.match(workflow, /continue-on-error:\s*true/);
  assert.match(workflow, /pattern:\s*render-server-logs-\*/);
});

test('workflow compares snapshots before publishing and uploading the current artifact', () => {
  const collect = workflow.indexOf('Collect and sanitize Render logs');
  const compare = workflow.indexOf('Compare with previous snapshot');
  const publish = workflow.indexOf('Publish summary to workflow run');
  const upload = workflow.indexOf('Upload Render log artifact');
  assert.ok(collect >= 0 && compare > collect && publish > compare && upload > publish);
  assert.match(workflow, /node scripts\/observability\/compare-render-snapshots\.mjs/);
  assert.match(workflow, /Regression \/ Degradation Detection/);
});
