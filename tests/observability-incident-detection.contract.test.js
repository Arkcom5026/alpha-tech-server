'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const routes = fs.readFileSync(
  path.join(root, 'src/modules/system/operational-verification/operationalVerificationRoutes.js'),
  'utf8'
);
const bootstrap = fs.readFileSync(path.join(root, 'src/bootstrap/server.js'), 'utf8');
const incidentLogger = fs.readFileSync(path.join(root, 'src/observability/runtimeIncidentLogger.js'), 'utf8');
const authTrace = fs.readFileSync(path.join(root, 'middlewares/authTrace.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

assert.match(server, /res\.setHeader\('X-Request-Id', req\.id\)/, 'server must expose request correlation id');
assert.match(server, /exposedHeaders:[\s\S]*'X-Request-Id'/, 'CORS must expose request correlation id to clients');

assert.match(routes, /router\.get\('\/health\/live'/, 'liveness endpoint must remain available');
assert.match(routes, /router\.get\('\/health\/ready', async/, 'readiness must perform an async dependency check');
assert.match(routes, /SELECT 1 AS ready/, 'readiness must prove database connectivity');
assert.match(routes, /scope: 'process\+database'/, 'readiness scope must identify process and database authority');
assert.match(routes, /status\(503\)/, 'dependency failure must make readiness fail closed');
assert.match(routes, /DATABASE_NOT_READY/, 'readiness failure must expose a stable incident code');
assert.match(routes, /recordIncident\('READINESS_DATABASE_UNAVAILABLE'/, 'readiness dependency failure must emit a structured incident signal');
assert.match(routes, /requestId: req\.id/, 'health responses must carry request correlation id');
assert.ok(
  routes.indexOf("router.get('/health/ready'") < routes.indexOf('router.use(verifyToken'),
  'platform readiness must remain public for infrastructure probes'
);

assert.match(incidentLogger, /event: 'runtime_incident'/, 'runtime incidents must use a stable structured event name');
assert.match(incidentLogger, /occurredAt: new Date\(\)\.toISOString\(\)/, 'runtime incidents must be timestamped');
assert.match(incidentLogger, /postgres\(\?:ql\)\?/, 'incident logging must redact database credentials');
assert.match(incidentLogger, /Bearer\\s\+/, 'incident logging must redact bearer credentials');
assert.match(bootstrap, /uncaughtExceptionMonitor/, 'bootstrap must observe uncaught process failures without suppressing Node default failure semantics');
assert.match(bootstrap, /PROCESS_UNCAUGHT_EXCEPTION/, 'uncaught process failures must have a stable incident code');
assert.match(bootstrap, /SERVER_STARTUP_FAILED/, 'startup failures must have a stable incident code');
assert.match(bootstrap, /event: 'server_started'/, 'server lifecycle start must emit a structured event');

assert.match(authTrace, /AUTH_TRACE_ENABLED === 'true'/, 'verbose auth tracing must require an explicit runtime opt-in');
assert.match(authTrace, /if \(!traceEnabled\(\)\) return next\(\)/, 'disabled auth tracing must bypass request instrumentation');
assert.match(authTrace, /reqId=\$\{req\.id \|\| 'UNKNOWN'\}/, 'auth diagnostics must correlate to the canonical request id when enabled');

console.log('Observability Incident Detection Contract: PASS');
