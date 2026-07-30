'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const resolver = fs.readFileSync(path.join(root, 'scripts', 'resolve-test-foundation-migrations.js'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

assert.match(resolver, /dotenv\.config\(\{ path: envPath, override: true \}\)/);
assert.match(resolver, /RESTORE_DATABASE_MIGRATION_APPROVAL/);
assert.match(resolver, /assertTestDatabaseAuthority/);
assert.match(resolver, /requiresWriteApproval: true/);
assert.match(resolver, /20260728183000_supplier_payable_foundation/);
assert.match(resolver, /20260728223000_pos_held_cart_foundation/);
assert.match(resolver, /'migrate', 'resolve', '--applied', migration/);
assert.match(resolver, /DATABASE_URL: targetUrl/);
assert.match(resolver, /DIRECT_URL: targetUrl/);
assert.strictEqual(packageJson.scripts['resolve:test-foundations'], 'node scripts/resolve-test-foundation-migrations.js');
assert.strictEqual(packageJson.scripts['test:test-prisma-foundation-ledger-resolver'], 'node tests/test-prisma-foundation-ledger-resolver.contract.test.js');

console.log('test Prisma foundation ledger resolver contract: PASS');
