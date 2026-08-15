const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const nodeVersion = fs.readFileSync(path.join(root, '.nvmrc'), 'utf8').trim();
const workflow = fs.readFileSync(path.join(root, '.github/workflows/backend-ci.yml'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'src/modules/system/operational-verification/operationalVerificationRoutes.js'), 'utf8');

assert.equal(nodeVersion, '22', 'server Node authority must be Node 22');
assert.match(workflow, /node-version:\s*22\b/, 'Backend CI must use Node 22');
assert.match(workflow, /branches:\s*\n\s*- main/, 'Backend CI must protect canonical main authority');
assert.doesNotMatch(workflow, /integration\/system-hardening-7-agendas/, 'retired integration branch must not remain CI authority');
assert.doesNotMatch(workflow, /npm start > backend-startup\.log/, 'CI startup verification must bypass mutation-capable prestart hooks');
assert.match(routes, /RENDER_GIT_COMMIT/, 'release metadata must expose Render commit provenance when available');
assert.match(routes, /router\.get\('\/release'/, 'release endpoint must exist');
assert.match(routes, /router\.get\('\/health\/live'/, 'liveness endpoint must exist');
assert.match(routes, /router\.get\('\/health\/ready'/, 'readiness endpoint must exist');
assert.ok(routes.indexOf("router.get('/release'") < routes.indexOf('router.use(verifyToken'), 'release endpoint must remain public for incident inspection');

console.log('Release Safety Foundation Contract: PASS');
