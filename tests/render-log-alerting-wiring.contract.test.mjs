import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const compareScript = await readFile(new URL('../scripts/observability/compare-render-snapshots.mjs', import.meta.url), 'utf8');
const workflow = await readFile(new URL('../.github/workflows/render-log-observability.yml', import.meta.url), 'utf8');

test('snapshot comparison emits threshold alert classification into regression artifacts', () => {
  assert.match(compareScript, /classifyRegressionAlert/);
  assert.match(compareScript, /formatAlertSummary/);
  assert.match(compareScript, /result\.alerting\s*=\s*classifyRegressionAlert\(result\)/);
  assert.match(compareScript, /Threshold \/ Alerting:/);
  assert.match(compareScript, /do not automatically block deployment in Wave 1/);
});

test('workflow continues publishing regression output without gaining write authority', () => {
  assert.match(workflow, /contents:\s*read/);
  assert.match(workflow, /actions:\s*read/);
  assert.doesNotMatch(workflow, /contents:\s*write/);
  assert.doesNotMatch(workflow, /actions:\s*write/);
  assert.match(workflow, /cat artifacts\/render-logs\/regression\.txt/);
});
