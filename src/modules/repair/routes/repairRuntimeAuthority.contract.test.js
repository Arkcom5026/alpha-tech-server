const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routesPath = path.join(__dirname, 'repairRoutes.js');
const routes = fs.readFileSync(routesPath, 'utf8');

test('repair runtime exposes workflow commands and not legacy free-status endpoint', () => {
  assert.match(routes, /\/jobs\/:id\/workflow\/commands/);
  assert.doesNotMatch(routes, /router\.patch\('\/jobs\/:id\/status'/);
  assert.doesNotMatch(routes, /updateRepairJobStatusController/);
});

test('claim and replacement operational routes remain capability-gated', () => {
  assert.match(routes, /warranty-claim-options[^\n]+REPAIR_CAPABILITY\.CLAIM/);
  assert.match(routes, /replacement-options[^\n]+REPAIR_CAPABILITY\.CLAIM/);
  assert.match(routes, /warranty-claims\/:claimId\/status[^\n]+REPAIR_CAPABILITY\.CLAIM/);
});
