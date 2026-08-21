import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOperationalHealth,
  formatOperationalHealthSummary,
} from '../scripts/observability/render-operational-health.mjs';

const analytics = (overrides = {}) => ({
  requestCount: 20,
  sampleMaturity: 'ESTABLISHED',
  errorRate: 0,
  p95Ms: 300,
  duplicateCallRate2s: 0,
  conflictRate: 0,
  ...overrides,
});

const comparison = (overrides = {}) => ({
  status: 'STABLE',
  degradedSignals: [],
  ...overrides,
});

const alerting = (overrides = {}) => ({
  severity: 'INFO',
  deploymentBlocking: false,
  ...overrides,
});

test('LOW sample maturity yields UNKNOWN health without a numeric score', () => {
  const health = buildOperationalHealth({
    analytics: analytics({ requestCount: 4, sampleMaturity: 'LOW' }),
    comparison: comparison(),
    alerting: alerting(),
  });

  assert.equal(health.state, 'UNKNOWN');
  assert.equal(health.score, null);
  assert.equal(health.confidence, 'LOW');
  assert.equal(health.deploymentBlocking, false);
});

test('healthy established snapshot remains HEALTHY with full score', () => {
  const health = buildOperationalHealth({
    analytics: analytics(),
    comparison: comparison(),
    alerting: alerting(),
  });

  assert.equal(health.state, 'HEALTHY');
  assert.equal(health.score, 100);
  assert.equal(health.confidence, 'HIGH');
  assert.deepEqual(health.components, []);
});

test('absolute latency and duplicate traffic signals lower score into WATCH', () => {
  const health = buildOperationalHealth({
    analytics: analytics({ p95Ms: 1200, duplicateCallRate2s: 0.12 }),
    comparison: comparison(),
    alerting: alerting(),
  });

  assert.equal(health.state, 'WATCH');
  assert.equal(health.score, 85);
  assert.equal(health.components.some((item) => item.key === 'latency-p95'), true);
  assert.equal(health.components.some((item) => item.key === 'duplicate-call-rate'), true);
});

test('warning regression produces DEGRADED health while remaining report-only', () => {
  const health = buildOperationalHealth({
    analytics: analytics({ p95Ms: 700 }),
    comparison: comparison({ status: 'DEGRADED', degradedSignals: [{ key: 'p95Ms' }] }),
    alerting: alerting({ severity: 'WARNING' }),
  });

  assert.equal(health.state, 'DEGRADED');
  assert.equal(health.score, 75);
  assert.equal(health.deploymentBlocking, false);
});

test('critical alert produces CRITICAL health even before score crosses 50', () => {
  const health = buildOperationalHealth({
    analytics: analytics({ errorRate: 0.06 }),
    comparison: comparison({ status: 'DEGRADED', degradedSignals: [{ key: 'errorRate' }] }),
    alerting: alerting({ severity: 'CRITICAL' }),
  });

  assert.equal(health.state, 'CRITICAL');
  assert.equal(health.score, 40);
  assert.equal(health.alertSeverity, 'CRITICAL');
});

test('summary exposes health state score confidence and report-only semantics', () => {
  const health = buildOperationalHealth({
    analytics: analytics({ sampleMaturity: 'EMERGING', requestCount: 10 }),
    comparison: comparison(),
    alerting: alerting(),
  });
  const lines = formatOperationalHealthSummary(health);

  assert.equal(lines.some((line) => line === 'Operational health: HEALTHY'), true);
  assert.equal(lines.some((line) => line === 'Health score: 100/100'), true);
  assert.equal(lines.some((line) => line === 'Confidence: MEDIUM'), true);
  assert.equal(lines.some((line) => line === 'Deployment blocking: no (report-only)'), true);
});
