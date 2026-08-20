'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(
  path.join(root, 'scripts/deploy-document-replacement-migration-test-db.js'),
  'utf8',
);

assert.match(script, /\.env\.restore/);
assert.match(script, /RESTORE_DATABASE_URL/);
assert.match(script, /assertTestDatabaseAuthority/);
assert.match(script, /requiresWriteApproval:\s*true/);
assert.match(script, /DATABASE_URL:\s*targetUrl/);
assert.match(script, /DIRECT_URL:\s*targetUrl/);
assert.match(script, /ALPHATECH_RUNTIME_ENV:\s*'TEST'/);
assert.match(script, /require\.resolve\(['"]prisma\/build\/index\.js['"]\)/);
assert.match(script, /spawn\(process\.execPath,\s*\[prismaCli,\s*['"]migrate['"],\s*['"]deploy['"]\]/);
assert.doesNotMatch(script, /migrate\s+dev/i);
assert.doesNotMatch(script, /db\s+push/i);
assert.doesNotMatch(script, /reset/i);

console.log('Document replacement financial lock Wave 7B Test DB deploy contract: PASS');
