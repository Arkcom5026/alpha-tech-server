'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const routes = fs.readFileSync(
  path.join(root, 'src/modules/system/operational-verification/operationalVerificationRoutes.js'),
  'utf8'
);
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

assert.match(server, /res\.setHeader\('X-Request-Id', req\.id\)/, 'server must expose request correlation id');
assert.match(server, /exposedHeaders:[\s\S]*'X-Request-Id'/, 'CORS must expose request correlation id to clients');

assert.match(routes, /router\.get\('\/health\/live'/, 'liveness endpoint must remain available');
assert.match(routes, /router\.get\('\/health\/ready', async/, 'readiness must perform an async dependency check');
assert.match(routes, /SELECT 1 AS ready/, 'readiness must prove database connectivity');
assert.match(routes, /scope: 'process\+database'/, 'readiness scope must identify process and database authority');
assert.match(routes, /status\(503\)/, 'dependency failure must make readiness fail closed');
assert.match(routes, /DATABASE_NOT_READY/, 'readiness failure must expose a stable incident code');
assert.match(routes, /\[INCIDENT\]\[READINESS_DATABASE_UNAVAILABLE\]/, 'readiness dependency failure must emit an incident signal');
assert.match(routes, /requestId: req\.id/, 'health responses must carry request correlation id');
assert.ok(
  routes.indexOf("router.get('/health/ready'") < routes.indexOf('router.use(verifyToken'),
  'platform readiness must remain public for infrastructure probes'
);

console.log('Observability Incident Detection Contract: PASS');
