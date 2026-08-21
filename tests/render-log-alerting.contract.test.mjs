import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyRegressionAlert, formatAlertSummary } from '../scripts/observability/render-log-alerting.mjs';

const baseResult = ({ status = 'STABLE', maturity = 'EMERGING', degradedSignals = [], improvedSignals = [] } = {}) => ({
  current: { sampleMaturity: maturity },
  previous: { sampleMaturity: maturity },
  comparison: {
    status,
    global: { currentMaturity: maturity, previousMaturity: maturity },
    degradedSignals,
    improvedSignals,
  },
});

test('missing baseline and low samples are suppressed rather than alerted', () => {
  const noBaseline = classifyRegressionAlert({ comparison: { status: 'NO_BASELINE' } });
  assert.equal(noBaseline.severity, 'SUPPRESSED');
  assert.equal(noBaseline.reason, 'NO_BASELINE');
  assert.equal(noBaseline.deploymentBlocking, false);

  const low = classifyRegressionAlert(baseResult({ status: 'DEGRADED', maturity: 'LOW', degradedSignals: [{ status: 'DEGRADED', key: 'p95Ms' }] }));
  assert.equal(low.severity, 'SUPPRESSED');
  assert.equal(low.reason, 'INSUFFICIENT_DATA');
});

test('ordinary material degradation becomes WARNING and never blocks deployment in wave 1', () => {
  const result = classifyRegressionAlert(baseResult({
    status: 'DEGRADED',
    degradedSignals: [{
      scope: 'GET /api/a',
      key: 'p95Ms',
      label: 'Latency p95',
      status: 'DEGRADED',
      previous: 400,
      current: 800,
      absolute: 400,
      relative: 1,
    }],
  }));

  assert.equal(result.severity, 'WARNING');
  assert.equal(result.reason, 'DEGRADATION_DETECTED');
  assert.equal(result.deploymentBlocking, false);
  assert.equal(result.alerts.length, 1);
});

test('severe established 5xx regression is classified CRITICAL', () => {
  const result = classifyRegressionAlert(baseResult({
    status: 'DEGRADED',
    maturity: 'ESTABLISHED',
    degradedSignals: [{
      scope: 'GLOBAL',
      key: 'errorRate',
      label: '5xx error rate',
      status: 'DEGRADED',
      previous: 0.01,
      current: 0.08,
      absolute: 0.07,
      relative: 7,
    }],
  }));

  assert.equal(result.severity, 'CRITICAL');
  assert.equal(result.reason, 'CRITICAL_DEGRADATION');
});

test('extreme p95 regression can become CRITICAL while response-size degradation remains WARNING', () => {
  const result = classifyRegressionAlert(baseResult({
    status: 'DEGRADED',
    maturity: 'ESTABLISHED',
    degradedSignals: [
      {
        scope: 'POST /api/sales/complete', key: 'p95Ms', label: 'Latency p95', status: 'DEGRADED',
        previous: 900, current: 2100, absolute: 1200, relative: 1.333333,
      },
      {
        scope: 'GET /api/report', key: 'p95ResponseBytes', label: 'Response size p95', status: 'DEGRADED',
        previous: 20000, current: 50000, absolute: 30000, relative: 1.5,
      },
    ],
  }));

  assert.equal(result.severity, 'CRITICAL');
  assert.deepEqual(result.alerts.map((item) => item.severity), ['CRITICAL', 'WARNING']);
});

test('stable or improved comparisons are informational', () => {
  assert.equal(classifyRegressionAlert(baseResult()).severity, 'INFO');
  assert.equal(classifyRegressionAlert(baseResult({ status: 'IMPROVED', improvedSignals: [{ key: 'p95Ms' }] })).reason, 'IMPROVEMENT_DETECTED');
});

test('formatted alert summary preserves report-only authority', () => {
  const lines = formatAlertSummary({
    severity: 'WARNING',
    reason: 'DEGRADATION_DETECTED',
    deploymentBlocking: false,
    alerts: [{ severity: 'WARNING', scope: 'GLOBAL', label: 'Latency p95', previous: 400, current: 800, absolute: 400, relative: 1 }],
  });

  assert.ok(lines.includes('Deployment blocking: no (report-only)'));
  assert.ok(lines.some((line) => line.includes('[WARNING] [GLOBAL] Latency p95')));
});
