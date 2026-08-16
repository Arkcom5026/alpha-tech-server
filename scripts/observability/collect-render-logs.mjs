import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API_BASE = 'https://api.render.com/v1';
const apiKey = process.env.RENDER_API_KEY?.trim();
const serviceId = (process.env.RENDER_SERVICE_ID || 'srv-d5vg5v3uibrs73cp1vm0').trim();
const lookbackMinutes = Math.max(5, Math.min(1440, Number(process.env.RENDER_LOG_LOOKBACK_MINUTES || 75)));
const outputDir = path.resolve(process.env.RENDER_LOG_OUTPUT_DIR || 'artifacts/render-logs');

if (!apiKey) {
  throw new Error('RENDER_API_KEY is required. Add it as a GitHub Actions repository secret.');
}

const headers = {
  Accept: 'application/json',
  Authorization: `Bearer ${apiKey}`,
};

const fetchJson = async (url) => {
  const response = await fetch(url, { headers });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Render API ${response.status} ${response.statusText}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : null;
};

const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');
const labelsOf = (entry) => entry?.labels && typeof entry.labels === 'object' ? entry.labels : {};
const valueOf = (entry, ...keys) => {
  const labels = labelsOf(entry);
  for (const key of keys) {
    const value = firstValue(entry?.[key], labels?.[key]);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
};

const sanitizeText = (value) => {
  if (typeof value !== 'string') return value;
  return value
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/(cookie\s*[:=]\s*)[^\n]+/gi, '$1[REDACTED]')
    .replace(/([?&](?:token|access_token|refresh_token|api[_-]?key|key|secret|password)=)[^&#\s]*/gi, '$1[REDACTED]')
    .replace(/(refreshCookie\s*[=:]\s*)[^\s,}]+/gi, '$1[REDACTED]');
};

const sanitize = (value) => {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => {
      if (/^(authorization|cookie|set-cookie|token|accessToken|refreshToken|apiKey|secret|password)$/i.test(key)) {
        return [key, '[REDACTED]'];
      }
      return [key, sanitize(child)];
    }));
  }
  return sanitizeText(value);
};

const parseDurationMs = (entry) => {
  const direct = Number(firstValue(
    valueOf(entry, 'durationMs', 'duration_ms', 'responseTimeMS', 'responseTimeMs'),
  ));
  if (Number.isFinite(direct) && direct >= 0) return direct;
  const message = String(firstValue(entry?.message, entry?.text, entry?.log, '') || '');
  const matches = [...message.matchAll(/(?:responseTimeMS[=:\s]+|\s-\s)(\d+(?:\.\d+)?)\s*ms\b/gi)];
  if (!matches.length) return null;
  const candidate = Number(matches[matches.length - 1][1]);
  return Number.isFinite(candidate) ? candidate : null;
};

const normalizeTimestamp = (entry) => {
  const raw = firstValue(
    entry?.timestamp,
    entry?.time,
    entry?.createdAt,
    entry?.created_at,
    labelsOf(entry)?.timestamp,
  );
  if (!raw) return null;
  const numeric = Number(raw);
  const date = Number.isFinite(numeric)
    ? new Date(numeric > 1e12 ? numeric : numeric * 1000)
    : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const extractPath = (entry) => {
  const direct = valueOf(entry, 'path', 'requestPath', 'request_path');
  if (direct) return String(direct).split('?')[0];
  const message = String(firstValue(entry?.message, entry?.text, entry?.log, '') || '');
  const match = message.match(/\b(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+([^\s?]+)(?:\?[^\s]*)?/i);
  return match?.[1] || null;
};

const extractMethod = (entry) => {
  const direct = valueOf(entry, 'method');
  if (direct) return String(direct).toUpperCase();
  const message = String(firstValue(entry?.message, entry?.text, entry?.log, '') || '');
  return message.match(/\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/i)?.[1]?.toUpperCase() || null;
};

const extractStatus = (entry) => {
  const direct = Number(valueOf(entry, 'statusCode', 'status_code', 'status'));
  if (Number.isInteger(direct) && direct >= 100 && direct <= 599) return direct;
  const message = String(firstValue(entry?.message, entry?.text, entry?.log, '') || '');
  const match = message.match(/\b(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\S+\s+(\d{3})\b/i);
  return match ? Number(match[1]) : null;
};

const end = new Date();
const start = new Date(end.getTime() - lookbackMinutes * 60_000);

const service = await fetchJson(`${API_BASE}/services/${encodeURIComponent(serviceId)}`);
const ownerId = service?.ownerId;
if (!ownerId) throw new Error(`Render service ${serviceId} did not expose ownerId.`);

let pageStart = start.toISOString();
let pageEnd = end.toISOString();
let pageCount = 0;
const collected = [];
const seenWindows = new Set();

while (pageStart && pageEnd && pageCount < 200) {
  const windowKey = `${pageStart}|${pageEnd}`;
  if (seenWindows.has(windowKey)) break;
  seenWindows.add(windowKey);

  const params = new URLSearchParams({
    ownerId,
    resource: serviceId,
    startTime: pageStart,
    endTime: pageEnd,
    direction: 'forward',
    limit: '100',
  });
  const payload = await fetchJson(`${API_BASE}/logs?${params.toString()}`);
  const logs = Array.isArray(payload?.logs) ? payload.logs : Array.isArray(payload) ? payload : [];
  collected.push(...logs);
  pageCount += 1;

  if (!payload?.hasMore) break;
  pageStart = payload?.nextStartTime;
  pageEnd = payload?.nextEndTime;
  if (!pageStart || !pageEnd) break;
}

const sanitizedLogs = sanitize(collected);
const normalized = sanitizedLogs.map((entry, index) => ({
  index,
  timestamp: normalizeTimestamp(entry),
  method: extractMethod(entry),
  path: extractPath(entry),
  status: extractStatus(entry),
  durationMs: parseDurationMs(entry),
  level: valueOf(entry, 'level'),
  type: valueOf(entry, 'type'),
  entry,
}));

const requests = normalized.filter((item) => item.method || item.status || item.path);
const errors4xx = requests.filter((item) => item.status >= 400 && item.status < 500);
const errors5xx = requests.filter((item) => item.status >= 500 && item.status < 600);
const slow = requests.filter((item) => Number.isFinite(item.durationMs) && item.durationMs >= 500);
const printable = requests.filter((item) => item.path === '/api/sales/printable' || item.path === '/api/sales/printable-sales');

const duplicateCandidates = [];
const byKey = new Map();
for (const item of requests) {
  if (!item.timestamp || !item.path) continue;
  const key = `${item.method || 'UNKNOWN'} ${item.path}`;
  const previous = byKey.get(key);
  const currentMs = Date.parse(item.timestamp);
  if (previous) {
    const gapMs = currentMs - previous.timeMs;
    if (gapMs >= 0 && gapMs <= 10_000) {
      duplicateCandidates.push({ key, first: previous.timestamp, second: item.timestamp, gapMs });
    }
  }
  byKey.set(key, { timeMs: currentMs, timestamp: item.timestamp });
}

const countBy = (items, selector) => {
  const counts = new Map();
  for (const item of items) {
    const key = selector(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
};

const snapshot = {
  generatedAt: new Date().toISOString(),
  window: { start: start.toISOString(), end: end.toISOString(), lookbackMinutes },
  service: { id: serviceId, name: service?.name || null, region: service?.region || null },
  pagesFetched: pageCount,
  logCount: sanitizedLogs.length,
  logs: sanitizedLogs,
};

const summary = {
  generatedAt: snapshot.generatedAt,
  window: snapshot.window,
  service: snapshot.service,
  totalLogs: sanitizedLogs.length,
  requestLikeLogs: requests.length,
  http4xx: errors4xx.length,
  http5xx: errors5xx.length,
  slowRequests500ms: slow.length,
  printableRequests: printable.length,
  printableWithCacheBustTs: sanitizedLogs.filter((entry) => /\/api\/sales\/printable[^\n]*[?&]_ts=/i.test(JSON.stringify(entry))).length,
  duplicateCandidates10s: duplicateCandidates.length,
  topPaths: countBy(requests, (item) => item.path).map(([pathName, count]) => ({ path: pathName, count })),
  topStatuses: countBy(requests, (item) => item.status ? String(item.status) : null).map(([status, count]) => ({ status: Number(status), count })),
  slowest: slow.sort((a, b) => b.durationMs - a.durationMs).slice(0, 20).map(({ timestamp, method, path: requestPath, status, durationMs }) => ({ timestamp, method, path: requestPath, status, durationMs })),
  duplicateCandidates: duplicateCandidates.slice(0, 50),
};

const summaryText = [
  'ALPHA-TECH Render Log Snapshot',
  `Generated: ${summary.generatedAt}`,
  `Window: ${summary.window.start} -> ${summary.window.end} (${lookbackMinutes} min)`,
  `Service: ${summary.service.name || 'unknown'} (${serviceId})`,
  `Total logs: ${summary.totalLogs}`,
  `Request-like logs: ${summary.requestLikeLogs}`,
  `HTTP 4xx: ${summary.http4xx}`,
  `HTTP 5xx: ${summary.http5xx}`,
  `Slow requests >=500ms: ${summary.slowRequests500ms}`,
  `Printable requests: ${summary.printableRequests}`,
  `Printable requests containing _ts: ${summary.printableWithCacheBustTs}`,
  `Duplicate candidates <=10s: ${summary.duplicateCandidates10s}`,
  '',
  'Top paths:',
  ...summary.topPaths.map((item) => `- ${item.count} ${item.path}`),
  '',
  'Slowest requests:',
  ...summary.slowest.map((item) => `- ${item.durationMs}ms ${item.status || '-'} ${item.method || '-'} ${item.path || '-'}`),
  '',
  'Duplicate candidates:',
  ...summary.duplicateCandidates.map((item) => `- ${item.key} gap=${item.gapMs}ms ${item.first} -> ${item.second}`),
].join('\n');

await mkdir(outputDir, { recursive: true });
await Promise.all([
  writeFile(path.join(outputDir, 'render-logs.json'), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8'),
  writeFile(path.join(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8'),
  writeFile(path.join(outputDir, 'summary.txt'), `${summaryText}\n`, 'utf8'),
]);

console.log(summaryText);
