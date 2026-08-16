'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

const resolver = read('recovery/postgresClientTools.js');
const capture = read('recovery/captureRecoveryBundle.js');
const restore = read('recovery/restoreRecoveryBundle.js');
const preflight = read('recovery/preflightPostgresClientTools.js');

assert.ok(resolver.includes("MINIMUM_MAJOR_VERSION = 17"));
assert.ok(resolver.includes("path.join(postgresRoot, version, 'bin', exe)"));
assert.ok(resolver.includes('POSTGRES_CLIENT_BIN'));
assert.ok(resolver.includes("spawnSyncImpl(toolPath, ['--version']"));
assert.ok(resolver.includes('shell: false'));

assert.ok(capture.includes("requirePostgresTool('pg_dump'"));
assert.ok(!capture.includes("path.join(process.env.POSTGRES_CLIENT_BIN || '', 'pg_dump.exe')"));
assert.ok(restore.includes("requirePostgresTool('psql'"));
assert.ok(!restore.includes("path.join(process.env.POSTGRES_CLIENT_BIN || '', 'psql.exe')"));
assert.ok(preflight.includes("resolvePostgresTool('pg_dump'"));
assert.ok(preflight.includes("resolvePostgresTool('psql'"));
assert.ok(preflight.includes('databaseModified: false'));

console.log('recovery PostgreSQL client tools contract: PASS');
