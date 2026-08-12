const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

test('repair communication rollout has read-only preflight and post-deploy verification', () => {
  const preflight = read('scripts/preflight-repair-communication-migration.js');
  const verify = read('scripts/verify-repair-communication-migration.js');
  const guide = read('docs/migration/repair-mobile-communication-rollout.md');
  assert.doesNotMatch(preflight, /\$executeRaw|CREATE|ALTER|DROP/i);
  assert.match(verify, /missingDescriptions/);
  assert.match(guide, /snapshot/i);
  assert.match(guide, /unrelated migration is pending/i);
});
