'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

const capture = read('recovery/captureRecoveryBundle.js');
const restore = read('recovery/restoreRecoveryBundle.js');

assert.ok(capture.includes('--schema=public'));
assert.ok(capture.includes('--schema=legacy_tax'));
assert.ok(capture.includes('pg_export_snapshot'));
assert.ok(capture.includes('REPEATABLE READ READ ONLY'));
assert.ok(capture.includes('databaseModified: false'));
assert.ok(capture.includes('tableCounts'));
assert.ok(restore.includes('assertTestDatabaseAuthority'));
assert.ok(restore.includes('DROP SCHEMA IF EXISTS "public" CASCADE'));
assert.ok(restore.includes('DROP SCHEMA IF EXISTS "legacy_tax" CASCADE'));
assert.ok(restore.includes('ON_ERROR_STOP=1'));
assert.ok(restore.includes('Row-count verification failed'));
assert.ok(!/process\.env\.DATABASE_URL\b/.test(restore));

console.log('recovery bundle public + legacy_tax contract: PASS');
