const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'repairRoutes.js'), 'utf8');

const REQUIRED_ROUTES = [
  "router.get('/intake-search'",
  "router.get('/intake-context/:lookup'",
  "router.get('/customers/:customerId/warranty-assets'",
  "router.post('/intakes/external-device'",
  "router.get('/jobs'",
  "router.get('/jobs/:id'",
  "router.post('/jobs'",
  "router.post('/jobs/:id/workflow/commands'",
  "router.post('/jobs/:id/parts'",
  "router.get('/jobs/:id/part-stock-options'",
  "router.get('/jobs/:id/warranty-claim-options'",
  "router.post('/jobs/:id/warranty-claims'",
  "router.get('/warranty-claims'",
  "router.get('/warranty-claims/:claimId/replacement-options'",
  "router.get('/warranty-claims/:claimId'",
  "router.patch('/warranty-claims/:claimId/status'",
  "router.get('/jobs/:id/estimate-approval'",
  "router.post('/jobs/:id/estimate-approval'",
  "router.get('/jobs/:id/handover'",
  "router.post('/jobs/:id/handover/finalize'",
  "router.get('/jobs/:id/intake-evidence'",
  "router.post('/jobs/:id/intake-evidence'",
  "router.post('/jobs/:id/tracking-access'",
  "router.post('/jobs/:id/tracking-access/rotate'",
  "router.delete('/jobs/:id/tracking-access'",
  "router.get('/public/tracking/:token'",
  "router.post('/public/tracking/:token/estimate-decision'",
  "router.post('/public/tracking/:token/pickup-confirmation'",
];

test('repair server mounts every runtime route required by the current FE contract', () => {
  for (const route of REQUIRED_ROUTES) {
    assert.ok(source.includes(route), `missing repair route: ${route}`);
  }
});

test('legacy free-status repair mutation is not mounted', () => {
  assert.ok(!source.includes("router.patch('/jobs/:id/status'"));
  assert.ok(source.includes('workflow/commands'));
});

test('inventory and claim mutation routes remain capability-gated', () => {
  assert.match(source, /part-stock-options[^\n]*REPAIR_CAPABILITY\.PARTS/);
  assert.match(source, /jobs\/:id\/parts[^\n]*REPAIR_CAPABILITY\.PARTS/);
  assert.match(source, /warranty-claim-options[^\n]*REPAIR_CAPABILITY\.CLAIM/);
  assert.match(source, /warranty-claims[^\n]*REPAIR_CAPABILITY\.CLAIM/);
});
