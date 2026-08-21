import test from 'node:test';
import assert from 'node:assert/strict';
import { compareHttpAnalytics } from '../scripts/observability/render-log-regression.mjs';

const endpoint = (overrides = {}) => ({
  key: 'GET /api/example',
  count: 20,
  sampleMaturity: 'ESTABLISHED',
  p50Ms: 100,
  p95Ms: 200,
  errorRate: 0,
  conflictRate: 0,
  duplicateCallRate2s: 0,
  p95ResponseBytes: 5000,
  ...overrides,
});

const analytics = (overrides = {}) => ({
  requestCount: 20,
  sampleMaturity: 'ESTABLISHED',
  p50Ms: 100,
  p95Ms: 200,
  errorRate: 0,
  conflictRate: 0,
  duplicateCallRate2s: 0,
  p95ResponseBytes: 5000,
  endpoints: [endpoint()],
  ...overrides,
});

test('missing previous snapshot yields NO_BASELINE instead of a false regression', () => {
  const result = compareHttpAnalytics(analytics(), null);
  assert.equal(result.status, 'NO_BASELINE');
  assert.equal(result.degradedSignals.length, 0);
});

test('low-sample snapshots are not promoted to degradation findings', () => {
  const current = analytics({ sampleMaturity: 'LOW', requestCount: 4, p95Ms: 1000 });
  const previous = analytics({ sampleMaturity: 'LOW', requestCount: 4, p95Ms: 100 });
  const result = compareHttpAnalytics(current, previous);
  assert.equal(result.status, 'INSUFFICIENT_DATA');
  assert.equal(result.global.status, 'INSUFFICIENT_DATA');
  assert.equal(result.degradedSignals.length, 0);
});

test('material p95 increase becomes a degradation only after maturity guard passes', () => {
  const current = analytics({ p95Ms: 500 });
  const previous = analytics({ p95Ms: 200 });
  const result = compareHttpAnalytics(current, previous);
  assert.equal(result.status, 'DEGRADED');
  const signal = result.degradedSignals.find((item) => item.scope === 'GLOBAL' && item.key === 'p95Ms');
  assert.ok(signal);
  assert.equal(signal.absolute, 300);
  assert.equal(signal.relative, 1.5);
});

test('small noise remains stable even when percentage change looks large', () => {
  const current = analytics({ p95Ms: 180 });
  const previous = analytics({ p95Ms: 100 });
  const result = compareHttpAnalytics(current, previous);
  assert.equal(result.degradedSignals.some((item) => item.key === 'p95Ms'), false);
});

test('endpoint degradation is reported with endpoint scope', () => {
  const current = analytics({ endpoints: [endpoint({ p95Ms: 800 })] });
  const previous = analytics({ endpoints: [endpoint({ p95Ms: 300 })] });
  const result = compareHttpAnalytics(current, previous);
  const signal = result.degradedSignals.find((item) => item.scope === 'GET /api/example' && item.key === 'p95Ms');
  assert.ok(signal);
});

test('material improvement is visible when no degradation exists', () => {
  const current = analytics({ p95Ms: 200 });
  const previous = analytics({ p95Ms: 500 });
  const result = compareHttpAnalytics(current, previous);
  assert.equal(result.status, 'IMPROVED');
  assert.ok(result.improvedSignals.some((item) => item.key === 'p95Ms'));
});
