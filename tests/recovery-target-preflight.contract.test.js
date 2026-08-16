'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

const preflight = read('recovery/preflightRecoveryTarget.js');
const authority = read('recovery/testDatabaseAuthority.js');

assert.ok(preflight.includes("require('./testDatabaseAuthority')"));
assert.ok(preflight.includes('requiresWriteApproval: false'));
assert.ok(preflight.includes('requiresResetApproval: false'));
assert.ok(preflight.includes('databaseModified: false'));
assert.ok(preflight.includes('RESTORE_DATABASE_URL || process.env.RECOVERY_DATABASE_URL'));
assert.ok(!preflight.includes('new Client('));
assert.ok(!preflight.includes('DROP SCHEMA'));
assert.ok(!preflight.includes('DELETE '));
assert.ok(!preflight.includes('UPDATE '));
assert.ok(!preflight.includes('INSERT '));

assert.ok(authority.includes("RESTORE_DATABASE_ENVIRONMENT must equal TEST"));
assert.ok(authority.includes('Restore target must not match'));
assert.ok(authority.includes('DATABASE_URL'));
assert.ok(authority.includes('DIRECT_URL'));
assert.ok(authority.includes('PRODUCTION_DATABASE_URL'));

console.log('recovery target preflight contract: PASS');
