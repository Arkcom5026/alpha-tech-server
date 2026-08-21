import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHttpAnalytics, percentile } from '../scripts/observability/render-log-analytics.mjs';

test('percentile uses deterministic nearest-rank semantics', () => {
  assert.equal(percentile([], 0.95), null);
  assert.equal(percentile([10, 20, 30, 40], 0.5), 20);
  assert.equal(percentile([10, 20, 30, 40], 0.95), 40);
});

test('HTTP analytics reports latency, error, conflict and response-size baselines', () => {
  const requests = [
    { timestamp: '2026-08-21T03:00:00.000Z', method: 'GET', path: '/api/a', target: '/api/a?q=1', status: 200, durationMs: 100, responseBytes: 1000, requestId: 'a1' },
    { timestamp: '2026-08-21T03:00:01.000Z', method: 'GET', path: '/api/a', target: '/api/a?q=1', status: 409, durationMs: 200, responseBytes: 2000, requestId: 'a2' },
    { timestamp: '2026-08-21T03:00:02.000Z', method: 'GET', path: '/api/a', target: '/api/a?q=2', status: 500, durationMs: 900, responseBytes: 3000, requestId: 'a3' },
    { timestamp: '2026-08-21T03:00:03.000Z', method: 'POST', path: '/api/b', target: '/api/b', status: 201, durationMs: 400, responseBytes: 4000, requestId: 'b1' },
  ];

  const analytics = buildHttpAnalytics(requests);

  assert.equal(analytics.requestCount, 4);
  assert.equal(analytics.p50Ms, 200);
  assert.equal(analytics.p95Ms, 900);
  assert.equal(analytics.errors5xx, 1);
  assert.equal(analytics.errorRate, 0.25);
  assert.equal(analytics.conflicts409, 1);
  assert.equal(analytics.conflictRate, 0.25);
  assert.equal(analytics.avgResponseBytes, 2500);
  assert.equal(analytics.p95ResponseBytes, 4000);

  const endpoint = analytics.endpoints.find((item) => item.key === 'GET /api/a');
  assert.equal(endpoint.count, 3);
  assert.equal(endpoint.p50Ms, 200);
  assert.equal(endpoint.p95Ms, 900);
  assert.equal(endpoint.errorRate, 0.333333);
  assert.equal(endpoint.conflictRate, 0.333333);
});

test('duplicate signal requires the same exact target while keeping target values out of summaries', () => {
  const requests = [
    { timestamp: '2026-08-21T03:00:00.000Z', method: 'GET', path: '/api/search', target: '/api/search?q=one', status: 200, durationMs: 100 },
    { timestamp: '2026-08-21T03:00:00.500Z', method: 'GET', path: '/api/search', target: '/api/search?q=two', status: 200, durationMs: 100 },
    { timestamp: '2026-08-21T03:00:01.000Z', method: 'GET', path: '/api/search', target: '/api/search?q=one', status: 200, durationMs: 100 },
  ];

  const analytics = buildHttpAnalytics(requests);
  assert.equal(analytics.exactRepeatCandidates2s, 1);
  assert.equal(analytics.duplicateCallRate2s, 0.333333);
  assert.match(analytics.exactRepeatCandidates[0].key, /^GET \/api\/search target=[a-f0-9]{12}$/);
  assert.equal(analytics.exactRepeatCandidates[0].key.includes('q=one'), false);
});

test('request burst metric captures requests sharing a one-second bucket', () => {
  const requests = Array.from({ length: 6 }, (_, index) => ({
    timestamp: `2026-08-21T03:00:00.${String(index).padStart(3, '0')}Z`,
    method: 'GET',
    path: `/api/${index}`,
    target: `/api/${index}`,
    status: 200,
    durationMs: 10,
  }));

  const analytics = buildHttpAnalytics(requests);
  assert.equal(analytics.requestBurst.maxRequestsPerBucket, 6);
  assert.equal(analytics.requestBurst.burstBucketCount, 1);
});
