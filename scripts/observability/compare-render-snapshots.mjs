import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { compareHttpAnalytics } from './render-log-regression.mjs';
import { classifyRegressionAlert, formatAlertSummary } from './render-log-alerting.mjs';
import {
  buildOperationalHealth,
  formatOperationalHealthSummary,
} from './render-operational-health.mjs';

const outputDir = path.resolve(process.env.RENDER_LOG_OUTPUT_DIR || 'artifacts/render-logs');
const currentSummaryPath = path.resolve(process.env.RENDER_LOG_CURRENT_SUMMARY || path.join(outputDir, 'summary.json'));
const previousSummaryPath = path.resolve(process.env.RENDER_LOG_PREVIOUS_SUMMARY || 'artifacts/previous-render-logs/summary.json');

const readJsonIfPresent = async (filePath) => {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
};

const current = await readJsonIfPresent(currentSummaryPath);
if (!current?.httpAnalytics) {
  throw new Error(`Current Render summary is missing HTTP analytics: ${currentSummaryPath}`);
}

const previous = await readJsonIfPresent(previousSummaryPath);
const comparison = compareHttpAnalytics(current.httpAnalytics, previous?.httpAnalytics || null);
const result = {
  generatedAt: new Date().toISOString(),
  current: {
    generatedAt: current.generatedAt || null,
    window: current.window || null,
    requestCount: current.httpAnalytics.requestCount,
    sampleMaturity: current.httpAnalytics.sampleMaturity,
  },
  previous: previous ? {
    generatedAt: previous.generatedAt || null,
    window: previous.window || null,
    requestCount: previous.httpAnalytics?.requestCount ?? null,
    sampleMaturity: previous.httpAnalytics?.sampleMaturity || null,
  } : null,
  comparison,
};
result.alerting = classifyRegressionAlert(result);
result.health = buildOperationalHealth({
  analytics: current.httpAnalytics,
  comparison,
  alerting: result.alerting,
});

const pct = (value) => value === null || value === undefined ? '-' : `${(Number(value) * 100).toFixed(1)}%`;
const describeSignal = (item) => {
  const relative = item.relative === null ? 'n/a' : pct(item.relative);
  return `- [${item.scope}] ${item.label}: ${item.previous} -> ${item.current} (delta=${item.absolute}, relative=${relative})`;
};

const text = [
  'ALPHA-TECH Render Regression / Degradation Detection',
  `Generated: ${result.generatedAt}`,
  `Status: ${comparison.status}`,
  `Current sample maturity: ${result.current.sampleMaturity} (${result.current.requestCount} requests)`,
  `Previous baseline: ${result.previous ? `${result.previous.sampleMaturity || '-'} (${result.previous.requestCount ?? '-'} requests)` : 'not available'}`,
  '',
  'Operational Health:',
  ...formatOperationalHealthSummary(result.health),
  '',
  'Threshold / Alerting:',
  ...formatAlertSummary(result.alerting),
  '',
  'Guardrail:',
  '- LOW-sample snapshots never receive a numeric health score or degradation finding.',
  '- Health score is an operational review signal, not an SLA or deployment gate.',
  '- A metric must exceed both relative and absolute noise thresholds before it is classified as changed.',
  '- WARNING and CRITICAL are review priorities only; they do not automatically block deployment in Wave 1.',
  '- CRITICAL is reserved for severe mature-sample 5xx or p95 latency regressions.',
  '',
  `Degraded signals: ${comparison.degradedSignals.length}`,
  ...comparison.degradedSignals.map(describeSignal),
  '',
  `Improved signals: ${comparison.improvedSignals?.length || 0}`,
  ...(comparison.improvedSignals || []).map(describeSignal),
].join('\n');

await mkdir(outputDir, { recursive: true });
await Promise.all([
  writeFile(path.join(outputDir, 'regression.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8'),
  writeFile(path.join(outputDir, 'regression.txt'), `${text}\n`, 'utf8'),
  writeFile(path.join(outputDir, 'operational-health.json'), `${JSON.stringify(result.health, null, 2)}\n`, 'utf8'),
]);

console.log(text);
