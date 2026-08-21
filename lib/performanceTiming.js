const enabledValues = new Set(['1', 'true', 'yes', 'on']);

const isPerformanceTimingEnabled = () => (
  enabledValues.has(String(process.env.PERF_TIMING_LOGS || '').trim().toLowerCase())
);

const nowMs = () => Number(process.hrtime.bigint()) / 1e6;

const roundMs = (value) => Number(Number(value || 0).toFixed(3));

const emitPerformanceTiming = ({ operation, totalMs, phases, status = 'ok', logger = console.log }) => {
  if (!isPerformanceTimingEnabled()) return;
  logger('[perf]', JSON.stringify({
    operation,
    status,
    totalMs: roundMs(totalMs),
    ...(phases && Object.keys(phases).length ? { phases } : {}),
  }));
};

const createPerformanceTimer = (operation, { logger = console.log } = {}) => {
  const startedAt = nowMs();
  let lastMarkAt = startedAt;
  const phases = {};

  return {
    mark(label) {
      const current = nowMs();
      phases[label] = roundMs(current - lastMarkAt);
      lastMarkAt = current;
      return phases[label];
    },
    finish({ status = 'ok' } = {}) {
      const totalMs = roundMs(nowMs() - startedAt);
      emitPerformanceTiming({ operation, totalMs, phases, status, logger });
      return { operation, totalMs, phases: { ...phases }, status };
    },
  };
};

const measurePerformance = async (operation, operationFn, { logger = console.log } = {}) => {
  if (!isPerformanceTimingEnabled()) return operationFn();

  const startedAt = nowMs();
  let status = 'ok';
  try {
    return await operationFn();
  } catch (error) {
    status = 'error';
    throw error;
  } finally {
    emitPerformanceTiming({ operation, totalMs: nowMs() - startedAt, status, logger });
  }
};

module.exports = {
  createPerformanceTimer,
  emitPerformanceTiming,
  isPerformanceTimingEnabled,
  measurePerformance,
};
