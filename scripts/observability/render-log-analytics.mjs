import { createHash } from 'node:crypto';

const finite = (value) => Number.isFinite(Number(value));

export const percentile = (values, quantile) => {
  const sorted = values
    .map(Number)
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  if (!sorted.length) return null;
  const q = Math.max(0, Math.min(1, Number(quantile)));
  const index = Math.max(0, Math.ceil(q * sorted.length) - 1);
  return sorted[index];
};

const round = (value, digits = 3) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const rate = (count, total) => total > 0 ? round(count / total, 6) : 0;

const average = (values) => {
  const usable = values.map(Number).filter(Number.isFinite);
  if (!usable.length) return null;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
};

export const sampleMaturity = (count) => {
  const value = Number(count) || 0;
  if (value >= 20) return 'ESTABLISHED';
  if (value >= 5) return 'EMERGING';
  return 'LOW';
};

export const normalizeRoutePath = (pathValue) => {
  const path = String(pathValue || '');
  if (!path) return path;
  return path
    .split('/')
    .map((segment) => {
      if (/^\d+$/.test(segment)) return ':id';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment)) return ':uuid';
      if (/^[0-9a-f]{24}$/i.test(segment)) return ':hexid';
      return segment;
    })
    .join('/');
};

const endpointKey = (item) => `${item.method} ${item.path}`;
const routeFamilyKey = (item) => `${item.method} ${normalizeRoutePath(item.path)}`;
const fingerprint = (value) => createHash('sha256').update(String(value || '')).digest('hex').slice(0, 12);
const exactTargetKey = (item) => `${item.method} ${normalizeRoutePath(item.path)} target=${fingerprint(item.target || item.path)}`;

const buildEndpointMetrics = (requests) => {
  const groups = new Map();
  for (const item of requests) {
    if (!item?.method || !item?.path) continue;
    const key = endpointKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  return [...groups.entries()]
    .map(([key, items]) => {
      const durations = items.map((item) => item.durationMs).filter(finite).map(Number);
      const responseBytes = items.map((item) => item.responseBytes).filter(finite).map(Number);
      const errors5xx = items.filter((item) => item.status >= 500 && item.status < 600).length;
      const conflicts409 = items.filter((item) => item.status === 409).length;
      return {
        key,
        method: items[0].method,
        path: items[0].path,
        count: items.length,
        sampleMaturity: sampleMaturity(items.length),
        latencySamples: durations.length,
        p50Ms: percentile(durations, 0.5),
        p95Ms: percentile(durations, 0.95),
        avgMs: round(average(durations)),
        maxMs: durations.length ? Math.max(...durations) : null,
        errors5xx,
        errorRate: rate(errors5xx, items.length),
        conflicts409,
        conflictRate: rate(conflicts409, items.length),
        responseSizeSamples: responseBytes.length,
        avgResponseBytes: round(average(responseBytes), 1),
        p95ResponseBytes: percentile(responseBytes, 0.95),
        maxResponseBytes: responseBytes.length ? Math.max(...responseBytes) : null,
      };
    })
    .sort((left, right) => {
      const leftP95 = Number(left.p95Ms ?? -1);
      const rightP95 = Number(right.p95Ms ?? -1);
      if (rightP95 !== leftP95) return rightP95 - leftP95;
      return right.count - left.count;
    });
};

const buildExactRepeatMetrics = (requests, thresholdMs = 2000) => {
  const previousByTarget = new Map();
  const candidates = [];
  for (const item of requests) {
    if (!item?.timestamp || !item?.method || !item?.path) continue;
    const targetIdentity = item.target || item.path;
    const key = exactTargetKey(item);
    const previousKey = `${item.method} ${targetIdentity}`;
    const currentMs = Date.parse(item.timestamp);
    if (!Number.isFinite(currentMs)) continue;
    const previous = previousByTarget.get(previousKey);
    if (previous) {
      const gapMs = currentMs - previous.timeMs;
      if (gapMs >= 0 && gapMs <= thresholdMs) {
        candidates.push({
          key,
          routeFamily: routeFamilyKey(item),
          gapMs,
          first: previous.timestamp,
          second: item.timestamp,
          firstRequestId: previous.requestId || null,
          secondRequestId: item.requestId || null,
        });
      }
    }
    previousByTarget.set(previousKey, {
      timeMs: currentMs,
      timestamp: item.timestamp,
      requestId: item.requestId,
    });
  }
  return {
    thresholdMs,
    candidateCount: candidates.length,
    rate: rate(candidates.length, requests.length),
    candidates: candidates.slice(0, 50),
  };
};

const buildRetryAfterErrorMetrics = (requests, thresholdMs = 10_000) => {
  const previousByTarget = new Map();
  const candidates = [];
  for (const item of requests) {
    if (!item?.timestamp || !item?.method || !item?.path) continue;
    const targetIdentity = item.target || item.path;
    const previousKey = `${item.method} ${targetIdentity}`;
    const currentMs = Date.parse(item.timestamp);
    if (!Number.isFinite(currentMs)) continue;
    const previous = previousByTarget.get(previousKey);
    if (previous && previous.status >= 400) {
      const gapMs = currentMs - previous.timeMs;
      if (gapMs >= 0 && gapMs <= thresholdMs) {
        candidates.push({
          key: exactTargetKey(item),
          routeFamily: routeFamilyKey(item),
          gapMs,
          previousStatus: previous.status,
          resultingStatus: item.status,
          recovered: item.status < 400,
          firstRequestId: previous.requestId || null,
          secondRequestId: item.requestId || null,
        });
      }
    }
    previousByTarget.set(previousKey, {
      timeMs: currentMs,
      status: item.status,
      requestId: item.requestId,
    });
  }
  return {
    thresholdMs,
    candidateCount: candidates.length,
    recoveryCount: candidates.filter((item) => item.recovered).length,
    candidates: candidates.slice(0, 50),
  };
};

const buildBurstMetrics = (requests, bucketMs = 1000, threshold = 5) => {
  const buckets = new Map();
  for (const item of requests) {
    if (!item?.timestamp) continue;
    const timeMs = Date.parse(item.timestamp);
    if (!Number.isFinite(timeMs)) continue;
    const bucketStartMs = Math.floor(timeMs / bucketMs) * bucketMs;
    buckets.set(bucketStartMs, (buckets.get(bucketStartMs) || 0) + 1);
  }
  const ranked = [...buckets.entries()]
    .map(([bucketStartMs, count]) => ({
      bucketStart: new Date(bucketStartMs).toISOString(),
      count,
    }))
    .sort((left, right) => right.count - left.count || left.bucketStart.localeCompare(right.bucketStart));

  return {
    bucketMs,
    threshold,
    maxRequestsPerBucket: ranked[0]?.count || 0,
    burstBucketCount: ranked.filter((item) => item.count >= threshold).length,
    topBuckets: ranked.slice(0, 20),
  };
};

const buildRouteFamilyTrafficQuality = (requests) => {
  const groups = new Map();
  for (const item of requests) {
    if (!item?.method || !item?.path) continue;
    const key = routeFamilyKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  return [...groups.entries()]
    .map(([key, items]) => {
      const repeats = buildExactRepeatMetrics(items);
      const retries = buildRetryAfterErrorMetrics(items);
      const bursts = buildBurstMetrics(items);
      return {
        key,
        count: items.length,
        sampleMaturity: sampleMaturity(items.length),
        exactRepeatCandidates2s: repeats.candidateCount,
        duplicateCallRate2s: repeats.rate,
        retryAfterErrorCandidates10s: retries.candidateCount,
        retryRecoveryCount10s: retries.recoveryCount,
        maxRequestsPer1s: bursts.maxRequestsPerBucket,
        burstBucketCount1s: bursts.burstBucketCount,
      };
    })
    .sort((left, right) => (
      right.exactRepeatCandidates2s - left.exactRepeatCandidates2s
      || right.retryAfterErrorCandidates10s - left.retryAfterErrorCandidates10s
      || right.maxRequestsPer1s - left.maxRequestsPer1s
      || right.count - left.count
    ));
};

export const buildHttpAnalytics = (requests = []) => {
  const completed = requests.filter((item) => item?.method && item?.path && Number.isInteger(item?.status));
  const durations = completed.map((item) => item.durationMs).filter(finite).map(Number);
  const responseBytes = completed.map((item) => item.responseBytes).filter(finite).map(Number);
  const errors5xx = completed.filter((item) => item.status >= 500 && item.status < 600).length;
  const conflicts409 = completed.filter((item) => item.status === 409).length;
  const exactRepeats = buildExactRepeatMetrics(completed);
  const retriesAfterError = buildRetryAfterErrorMetrics(completed);
  const bursts = buildBurstMetrics(completed);
  const routeFamilies = buildRouteFamilyTrafficQuality(completed);

  return {
    requestCount: completed.length,
    sampleMaturity: sampleMaturity(completed.length),
    lowSampleCaution: completed.length < 20,
    latencySamples: durations.length,
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    avgMs: round(average(durations)),
    maxMs: durations.length ? Math.max(...durations) : null,
    errors5xx,
    errorRate: rate(errors5xx, completed.length),
    conflicts409,
    conflictRate: rate(conflicts409, completed.length),
    responseSizeSamples: responseBytes.length,
    avgResponseBytes: round(average(responseBytes), 1),
    p95ResponseBytes: percentile(responseBytes, 0.95),
    maxResponseBytes: responseBytes.length ? Math.max(...responseBytes) : null,
    duplicateCallRate2s: exactRepeats.rate,
    exactRepeatCandidates2s: exactRepeats.candidateCount,
    exactRepeatCandidates: exactRepeats.candidates,
    retryAfterErrorCandidates10s: retriesAfterError.candidateCount,
    retryRecoveryCount10s: retriesAfterError.recoveryCount,
    retryAfterErrorCandidates: retriesAfterError.candidates,
    requestBurst: bursts,
    trafficQuality: {
      lowSampleCaution: completed.length < 20,
      routeFamilies,
    },
    endpoints: buildEndpointMetrics(completed),
  };
};
