const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const severityPenalty = {
  SUPPRESSED: 0,
  INFO: 0,
  WARNING: 15,
  CRITICAL: 30,
};

const maturityConfidence = {
  LOW: 'LOW',
  EMERGING: 'MEDIUM',
  ESTABLISHED: 'HIGH',
};

const addPenalty = (components, key, points, reason) => {
  if (!points) return;
  components.push({ key, points, reason });
};

const absoluteHealthPenalties = (analytics, components) => {
  const errorRate = Number(analytics?.errorRate);
  if (Number.isFinite(errorRate)) {
    if (errorRate >= 0.05) addPenalty(components, '5xx', 30, '5xx error rate is at least 5%');
    else if (errorRate >= 0.02) addPenalty(components, '5xx', 20, '5xx error rate is at least 2%');
    else if (errorRate > 0) addPenalty(components, '5xx', 8, '5xx errors are present');
  }

  const p95Ms = Number(analytics?.p95Ms);
  if (Number.isFinite(p95Ms)) {
    if (p95Ms >= 2000) addPenalty(components, 'latency-p95', 20, 'Latency p95 is at least 2000ms');
    else if (p95Ms >= 1000) addPenalty(components, 'latency-p95', 10, 'Latency p95 is at least 1000ms');
    else if (p95Ms >= 500) addPenalty(components, 'latency-p95', 5, 'Latency p95 is at least 500ms');
  }

  const duplicateRate = Number(analytics?.duplicateCallRate2s);
  if (Number.isFinite(duplicateRate)) {
    if (duplicateRate >= 0.25) addPenalty(components, 'duplicate-call-rate', 10, 'Exact duplicate-call candidate rate is at least 25%');
    else if (duplicateRate >= 0.1) addPenalty(components, 'duplicate-call-rate', 5, 'Exact duplicate-call candidate rate is at least 10%');
  }

  const conflictRate = Number(analytics?.conflictRate);
  if (Number.isFinite(conflictRate) && conflictRate >= 0.25) {
    addPenalty(components, '409-conflict-rate', 5, '409 conflict rate is at least 25%; review domain conflict behavior');
  }
};

const stateFrom = ({ score, alertSeverity }) => {
  if (alertSeverity === 'CRITICAL' || score < 50) return 'CRITICAL';
  if (alertSeverity === 'WARNING' || score < 70) return 'DEGRADED';
  if (score < 90) return 'WATCH';
  return 'HEALTHY';
};

export const buildOperationalHealth = ({ analytics, comparison, alerting } = {}) => {
  const maturity = analytics?.sampleMaturity || 'LOW';
  const requestCount = Number(analytics?.requestCount) || 0;
  const confidence = maturityConfidence[maturity] || 'LOW';

  if (maturity === 'LOW') {
    return {
      state: 'UNKNOWN',
      score: null,
      confidence,
      requestCount,
      sampleMaturity: maturity,
      deploymentBlocking: false,
      reason: 'INSUFFICIENT_SAMPLE_MATURITY',
      components: [],
      regressionStatus: comparison?.status || 'NO_BASELINE',
      alertSeverity: alerting?.severity || 'SUPPRESSED',
    };
  }

  const components = [];
  absoluteHealthPenalties(analytics, components);

  const alertSeverity = alerting?.severity || 'SUPPRESSED';
  addPenalty(
    components,
    'regression-alert',
    severityPenalty[alertSeverity] || 0,
    alertSeverity === 'CRITICAL'
      ? 'Critical mature-sample regression alert is active'
      : 'Material mature-sample regression alert is active',
  );

  const degradedSignalCount = Array.isArray(comparison?.degradedSignals)
    ? comparison.degradedSignals.length
    : 0;
  if (degradedSignalCount >= 3) {
    addPenalty(components, 'multi-signal-regression', 10, 'Three or more degradation signals are active');
  } else if (degradedSignalCount >= 1 && alertSeverity === 'WARNING') {
    addPenalty(components, 'multi-signal-regression', 5, 'One or more material degradation signals are active');
  }

  const totalPenalty = components.reduce((sum, item) => sum + item.points, 0);
  const score = clamp(100 - totalPenalty, 0, 100);

  return {
    state: stateFrom({ score, alertSeverity }),
    score,
    confidence,
    requestCount,
    sampleMaturity: maturity,
    deploymentBlocking: false,
    reason: components.length ? 'HEALTH_SIGNALS_PRESENT' : 'NO_MATERIAL_HEALTH_SIGNAL',
    components,
    regressionStatus: comparison?.status || 'NO_BASELINE',
    alertSeverity,
  };
};

export const formatOperationalHealthSummary = (health) => {
  const score = health.score === null || health.score === undefined ? 'n/a' : `${health.score}/100`;
  return [
    `Operational health: ${health.state}`,
    `Health score: ${score}`,
    `Confidence: ${health.confidence}`,
    `Sample maturity: ${health.sampleMaturity} (${health.requestCount} requests)`,
    `Regression status: ${health.regressionStatus}`,
    `Alert severity: ${health.alertSeverity}`,
    `Deployment blocking: ${health.deploymentBlocking ? 'yes' : 'no (report-only)'}`,
    ...health.components.map((item) => `- penalty=${item.points} [${item.key}] ${item.reason}`),
  ];
};
