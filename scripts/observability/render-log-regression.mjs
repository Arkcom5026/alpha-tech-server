const finite = (value) => Number.isFinite(Number(value));

const round = (value, digits = 6) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const maturityRank = (value) => ({ LOW: 0, EMERGING: 1, ESTABLISHED: 2 }[value] ?? 0);
const comparable = (current, previous) => (
  current && previous
  && maturityRank(current.sampleMaturity) >= 1
  && maturityRank(previous.sampleMaturity) >= 1
);

const delta = (currentValue, previousValue) => {
  const current = Number(currentValue);
  const previous = Number(previousValue);
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  const absolute = current - previous;
  const relative = previous === 0 ? (current === 0 ? 0 : null) : absolute / previous;
  return { current, previous, absolute: round(absolute), relative: relative === null ? null : round(relative) };
};

const signal = ({ key, label, currentValue, previousValue, direction = 'higher-worse', relativeThreshold, absoluteThreshold }) => {
  const change = delta(currentValue, previousValue);
  if (!change) return null;
  const relativeMagnitude = change.relative === null ? Infinity : Math.abs(change.relative);
  const absoluteMagnitude = Math.abs(change.absolute);
  const changedEnough = relativeMagnitude >= relativeThreshold && absoluteMagnitude >= absoluteThreshold;
  if (!changedEnough) return { key, label, status: 'STABLE', ...change };

  const worsened = direction === 'higher-worse' ? change.absolute > 0 : change.absolute < 0;
  return { key, label, status: worsened ? 'DEGRADED' : 'IMPROVED', ...change };
};

const compareMetricSet = (current, previous) => {
  if (!comparable(current, previous)) {
    return {
      status: 'INSUFFICIENT_DATA',
      currentMaturity: current?.sampleMaturity || 'LOW',
      previousMaturity: previous?.sampleMaturity || 'LOW',
      signals: [],
    };
  }

  const definitions = [
    ['p50Ms', 'Latency p50', 0.5, 100],
    ['p95Ms', 'Latency p95', 0.5, 150],
    ['errorRate', '5xx error rate', 0.5, 0.01],
    ['conflictRate', '409 conflict rate', 0.5, 0.05],
    ['duplicateCallRate2s', 'Duplicate-call candidate rate', 0.5, 0.1],
    ['p95ResponseBytes', 'Response size p95', 0.5, 10_000],
  ];

  const signals = definitions
    .map(([key, label, relativeThreshold, absoluteThreshold]) => signal({
      key,
      label,
      currentValue: current[key],
      previousValue: previous[key],
      relativeThreshold,
      absoluteThreshold,
    }))
    .filter(Boolean);

  const degraded = signals.filter((item) => item.status === 'DEGRADED');
  const improved = signals.filter((item) => item.status === 'IMPROVED');
  return {
    status: degraded.length ? 'DEGRADED' : improved.length ? 'IMPROVED' : 'STABLE',
    currentMaturity: current.sampleMaturity,
    previousMaturity: previous.sampleMaturity,
    signals,
  };
};

const endpointMap = (analytics) => new Map((analytics?.endpoints || []).map((item) => [item.key, item]));

export const compareHttpAnalytics = (current, previous) => {
  if (!current || !previous) {
    return {
      status: 'NO_BASELINE',
      global: { status: 'INSUFFICIENT_DATA', signals: [] },
      endpoints: [],
      degradedSignals: [],
    };
  }

  const global = compareMetricSet(current, previous);
  const previousEndpoints = endpointMap(previous);
  const endpoints = (current.endpoints || [])
    .map((currentEndpoint) => {
      const previousEndpoint = previousEndpoints.get(currentEndpoint.key);
      if (!previousEndpoint) return null;
      return {
        key: currentEndpoint.key,
        count: currentEndpoint.count,
        comparison: compareMetricSet(currentEndpoint, previousEndpoint),
      };
    })
    .filter(Boolean)
    .filter((item) => item.comparison.status !== 'INSUFFICIENT_DATA');

  const degradedSignals = [
    ...global.signals
      .filter((item) => item.status === 'DEGRADED')
      .map((item) => ({ scope: 'GLOBAL', ...item })),
    ...endpoints.flatMap((item) => item.comparison.signals
      .filter((entry) => entry.status === 'DEGRADED')
      .map((entry) => ({ scope: item.key, ...entry }))),
  ];

  const improvedSignals = [
    ...global.signals
      .filter((item) => item.status === 'IMPROVED')
      .map((item) => ({ scope: 'GLOBAL', ...item })),
    ...endpoints.flatMap((item) => item.comparison.signals
      .filter((entry) => entry.status === 'IMPROVED')
      .map((entry) => ({ scope: item.key, ...entry }))),
  ];

  return {
    status: degradedSignals.length ? 'DEGRADED' : improvedSignals.length ? 'IMPROVED' : global.status === 'INSUFFICIENT_DATA' ? 'INSUFFICIENT_DATA' : 'STABLE',
    global,
    endpoints,
    degradedSignals,
    improvedSignals,
  };
};
