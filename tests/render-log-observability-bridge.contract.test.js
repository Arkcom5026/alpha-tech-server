const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const workflow = fs.readFileSync(path.join(root, '.github/workflows/render-log-observability.yml'), 'utf8');
const collector = fs.readFileSync(path.join(root, 'scripts/observability/collect-render-logs.mjs'), 'utf8');

assert.match(workflow, /workflow_dispatch:/, 'Render log bridge must support manual snapshots');
assert.match(workflow, /schedule:/, 'Render log bridge must support scheduled snapshots');
assert.match(workflow, /cron:\s*["']17 \* \* \* \*["']/, 'scheduled snapshot cadence must remain hourly');
assert.match(workflow, /secrets\.RENDER_API_KEY/, 'Render API key must come from GitHub Actions secrets');
assert.doesNotMatch(workflow, /rnd_[A-Za-z0-9_-]{10,}/, 'workflow must not contain a Render API key literal');
assert.match(workflow, /srv-d5vg5v3uibrs73cp1vm0/, 'bridge must target the canonical ALPHA-TECH Render server');
assert.match(workflow, /actions\/upload-artifact@v4/, 'Render logs must be published as a GitHub Actions artifact');
assert.match(workflow, /retention-days:\s*7/, 'Render log artifact retention must remain bounded');

assert.match(collector, /https:\/\/api\.render\.com\/v1/, 'collector must use the official Render API');
assert.match(collector, /\/services\/\$\{encodeURIComponent\(serviceId\)\}/, 'collector must derive workspace authority from the service');
assert.match(collector, /\/logs\?\$\{params\.toString\(\)\}/, 'collector must fetch Render logs through the canonical logs endpoint');
assert.match(collector, /Authorization:\s*`Bearer \$\{apiKey\}`/, 'collector must authenticate via bearer API key');
assert.match(collector, /\[REDACTED\]/, 'collector must redact sensitive values before artifact publication');
assert.match(collector, /const completedRequests = normalized\.filter/, 'request metrics must be based on completed HTTP access logs');
assert.match(collector, /Number\.isInteger\(item\.status\)/, 'completed request authority must require an HTTP status');
assert.match(collector, /extractRequestId/, 'collector must extract request IDs for correlation');
assert.match(collector, /printableWithCacheBustTs = printable\.filter/, 'printable _ts counts must be scoped to completed printable requests');
assert.match(collector, /Rapid-repeat candidates <=10s/, 'summary must surface rapid-repeat review candidates');
assert.match(collector, /does not prove an accidental duplicate request/, 'summary must not present rapid repeats as proven duplicates');
assert.doesNotMatch(collector, /Duplicate candidates <=10s/, 'legacy duplicate wording must not remain authoritative');
assert.match(collector, /Slow requests >=500ms/, 'summary must surface slow request candidates');
assert.match(collector, /render-logs\.json/, 'collector must publish raw sanitized log evidence');
assert.match(collector, /summary\.json/, 'collector must publish machine-readable summary evidence');
assert.match(collector, /summary\.txt/, 'collector must publish human-readable summary evidence');

console.log('Render Log Observability Bridge Contract: PASS');
