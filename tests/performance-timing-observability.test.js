const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPerformanceTimer,
  isPerformanceTimingEnabled,
  measurePerformance,
} = require('../lib/performanceTiming');

const withPerfEnv = async (value, fn) => {
  const previous = process.env.PERF_TIMING_LOGS;
  if (value == null) delete process.env.PERF_TIMING_LOGS;
  else process.env.PERF_TIMING_LOGS = value;
  try {
    return await fn();
  } finally {
    if (previous == null) delete process.env.PERF_TIMING_LOGS;
    else process.env.PERF_TIMING_LOGS = previous;
  }
};

test('performance timing is disabled by default', async () => {
  await withPerfEnv(null, async () => {
    assert.equal(isPerformanceTimingEnabled(), false);
    const logs = [];
    const result = await measurePerformance('test.disabled', async () => 42, {
      logger: (...args) => logs.push(args),
    });
    assert.equal(result, 42);
    assert.equal(logs.length, 0);
  });
});

test('measurePerformance emits one structured log when enabled', async () => {
  await withPerfEnv('1', async () => {
    const logs = [];
    const result = await measurePerformance('test.measure', async () => 'ok', {
      logger: (...args) => logs.push(args),
    });
    assert.equal(result, 'ok');
    assert.equal(logs.length, 1);
    assert.equal(logs[0][0], '[perf]');
    const payload = JSON.parse(logs[0][1]);
    assert.equal(payload.operation, 'test.measure');
    assert.equal(payload.status, 'ok');
    assert.equal(typeof payload.totalMs, 'number');
  });
});

test('createPerformanceTimer records named phases without request data', async () => {
  await withPerfEnv('true', async () => {
    const logs = [];
    const timer = createPerformanceTimer('sales.complete', {
      logger: (...args) => logs.push(args),
    });
    timer.mark('validate');
    timer.mark('completionTransaction');
    const summary = timer.finish({ status: 'ok' });

    assert.equal(summary.operation, 'sales.complete');
    assert.deepEqual(Object.keys(summary.phases), ['validate', 'completionTransaction']);
    assert.equal(logs.length, 1);
    const payload = JSON.parse(logs[0][1]);
    assert.deepEqual(Object.keys(payload.phases), ['validate', 'completionTransaction']);
    assert.equal(Object.hasOwn(payload, 'query'), false);
    assert.equal(Object.hasOwn(payload, 'body'), false);
  });
});
