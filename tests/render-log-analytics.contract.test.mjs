import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHttpAnalytics,
  normalizeRoutePath,
  percentile,
  sampleMaturity,
} from '../scripts/observability/render-log-analytics.mjs';

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
  assert.equal(analytics.lowSampleCaution, true);
  assert.equal(analytics.sampleMaturity, 'LOW');

  const endpoint = analytics.endpoints.find((item) => item.key === 'GET /api/a');
  assert.equal(endpoint.count, 3);
  assert.equal(endpoint.p50Ms, 200);
  assert.equal(endpoint.p95Ms, 900);
  assert.equal(endpoint.errorRate, 0.333333);
  assert.equal(endpoint.conflictRate, 0.333333);
  assert.equal(endpoint.sampleMaturity, 'LOW');
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

test('route normalization groups dynamic ids without hiding stable route names', () => {
  assert.equal(normalizeRoutePath('/api/repairs/jobs/12/handover'), '/api/repairs/jobs/:id/handover');
  assert.equal(normalizeRoutePath('/api/tax/documents/172/issue'), '/api/tax/documents/:id/issue');
  assert.equal(normalizeRoutePath('/api/request/45dc904f-7cfb-46ec-86a2-1c5b601dbbbd'), '/api/request/:uuid');
  assert.equal(normalizeRoutePath('/api/products/ready-to-sell'), '/api/products/ready-to-sell');
});

test('sample maturity avoids treating sparse production traffic as a stable baseline', () => {
  assert.equal(sampleMaturity(0), 'LOW');
  assert.equal(sampleMaturity(4), 'LOW');
  assert.equal(sampleMaturity(5), 'EMERGING');
  assert.equal(sampleMaturity(19), 'EMERGING');
  assert.equal(sampleMaturity(20), 'ESTABLISHED');
});

test('traffic quality aggregates dynamic route families and recognizes recovery retries', () => {
  const requests = [
    { timestamp: '2026-08-21T03:00:00.000Z', method: 'POST', path: '/api/tax/documents/172/issue', target: '/api/tax/documents/172/issue', status: 409, durationMs: 80, requestId: 'r1' },
    { timestamp: '2026-08-21T03:00:01.000Z', method: 'POST', path: '/api/tax/documents/172/issue', target: '/api/tax/documents/172/issue', status: 200, durationMs: 90, requestId: 'r2' },
    { timestamp: '2026-08-21T03:00:05.000Z', method: 'POST', path: '/api/tax/documents/173/issue', target: '/api/tax/documents/173/issue', status: 409, durationMs: 85, requestId: 'r3' },
  ];

  const analytics = buildHttpAnalytics(requests);
  const family = analytics.trafficQuality.routeFamilies.find((item) => item.key === 'POST /api/tax/documents/:id/issue');

  assert.equal(family.count, 3);
  assert.equal(family.sampleMaturity, 'LOW');
  assert.equal(family.exactRepeatCandidates2s, 1);
  assert.equal(family.retryAfterErrorCandidates10s, 1);
  assert.equal(family.retryRecoveryCount10s, 1);
  assert.equal(analytics.retryAfterErrorCandidates10s, 1);
  assert.equal(analytics.retryRecoveryCount10s, 1);
  assert.equal(analytics.retryAfterErrorCandidates[0].key.includes('/172/'), false);
});
