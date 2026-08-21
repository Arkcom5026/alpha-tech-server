const severityRank = { SUPPRESSED: 0, INFO: 1, WARNING: 2, CRITICAL: 3 };

const pct = (value) => Number.isFinite(Number(value)) ? Number(value) * 100 : null;

const criticalSignal = (signal) => {
  if (!signal || signal.status !== 'DEGRADED') return false;

  if (signal.key === 'errorRate') {
    return Number(signal.current) >= 0.05 && Number(signal.absolute) >= 0.02;
  }

  if (signal.key === 'p95Ms') {
    return Number(signal.current) >= 2000
      && Number(signal.absolute) >= 750
      && (signal.relative === null || Number(signal.relative) >= 1);
  }

  return false;
};

const warningReason = (signal) => {
  if (signal.key === 'p95Ms') return 'Latency p95 materially degraded';
  if (signal.key === 'p50Ms') return 'Latency p50 materially degraded';
  if (signal.key === 'errorRate') return '5xx error rate materially degraded';
  if (signal.key === 'conflictRate') return '409 conflict rate materially degraded';
  if (signal.key === 'duplicateCallRate2s') return 'Duplicate-call candidate rate materially degraded';
  if (signal.key === 'p95ResponseBytes') return 'Response-size p95 materially degraded';
  return 'Observed metric materially degraded';
};

const alertFromSignal = (signal) => {
  const severity = criticalSignal(signal) ? 'CRITICAL' : 'WARNING';
  return {
    severity,
    scope: signal.scope,
    key: signal.key,
    label: signal.label,
    reason: warningReason(signal),
    previous: signal.previous,
    current: signal.current,
    absolute: signal.absolute,
    relative: signal.relative,
  };
};

export const classifyRegressionAlert = (regressionResult) => {
  const comparison = regressionResult?.comparison || regressionResult;
  const currentMaturity = regressionResult?.current?.sampleMaturity || comparison?.global?.currentMaturity || 'LOW';
  const previousMaturity = regressionResult?.previous?.sampleMaturity || comparison?.global?.previousMaturity || 'LOW';

  if (!comparison || comparison.status === 'NO_BASELINE') {
    return {
      severity: 'SUPPRESSED',
      reason: 'NO_BASELINE',
      deploymentBlocking: false,
      alerts: [],
    };
  }

  if (comparison.status === 'INSUFFICIENT_DATA' || currentMaturity === 'LOW' || previousMaturity === 'LOW') {
    return {
      severity: 'SUPPRESSED',
      reason: 'INSUFFICIENT_DATA',
      deploymentBlocking: false,
      alerts: [],
    };
  }

  const alerts = (comparison.degradedSignals || []).map(alertFromSignal);
  if (alerts.length) {
    const severity = alerts.reduce(
      (highest, item) => severityRank[item.severity] > severityRank[highest] ? item.severity : highest,
      'WARNING',
    );
    return {
      severity,
      reason: severity === 'CRITICAL' ? 'CRITICAL_DEGRADATION' : 'DEGRADATION_DETECTED',
      deploymentBlocking: false,
      alerts,
    };
  }

  const improvements = comparison.improvedSignals || [];
  return {
    severity: 'INFO',
    reason: improvements.length ? 'IMPROVEMENT_DETECTED' : 'STABLE',
    deploymentBlocking: false,
    alerts: [],
  };
};

export const formatAlertSummary = (alerting) => {
  const lines = [
    `Alert severity: ${alerting.severity}`,
    `Alert reason: ${alerting.reason}`,
    `Deployment blocking: ${alerting.deploymentBlocking ? 'yes' : 'no (report-only)'}`,
  ];

  for (const alert of alerting.alerts || []) {
    const relative = alert.relative === null || alert.relative === undefined
      ? 'n/a'
      : `${pct(alert.relative).toFixed(1)}%`;
    lines.push(`- [${alert.severity}] [${alert.scope}] ${alert.label}: ${alert.previous} -> ${alert.current} (delta=${alert.absolute}, relative=${relative})`);
  }

  return lines;
};
