import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../scripts/observability/compare-render-snapshots.mjs', import.meta.url), 'utf8');

test('snapshot comparison builds operational health from current analytics regression and alerting', () => {
  assert.match(source, /buildOperationalHealth/);
  assert.match(source, /analytics:\s*current\.httpAnalytics/);
  assert.match(source, /comparison,/);
  assert.match(source, /alerting:\s*result\.alerting/);
});

test('operational health is included in human-readable and artifact output', () => {
  assert.match(source, /Operational Health:/);
  assert.match(source, /formatOperationalHealthSummary\(result\.health\)/);
  assert.match(source, /operational-health\.json/);
});

test('health scoring remains report-only and low-sample guarded in workflow text', () => {
  assert.match(source, /LOW-sample snapshots never receive a numeric health score/);
  assert.match(source, /not an SLA or deployment gate/);
});
