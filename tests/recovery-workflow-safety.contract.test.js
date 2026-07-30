'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

const runner = read('recovery/jobRunner.js');
const restore = read('qbrs.js');
const verifier = read('recovery/verify/qbv.js');
const uploader = read('recovery/upload/uploadBackup.js');

assert.ok(runner.includes('RECOVERY_DRILL_APPROVAL'));
assert.ok(runner.includes('RECOVERY_RETENTION_APPLY_APPROVAL'));
assert.ok(runner.includes('RECOVERY_R2_RETENTION_APPLY_APPROVAL'));
assert.ok(runner.includes("fs.openSync(LOCK_FILE,'wx')"));
assert.ok(runner.includes('shell:false'));
assert.ok(runner.includes('recovery/verify/qbv.js not found; recovery cannot be certified'));
assert.ok(runner.includes('R2_PREFIX/S3_PREFIX is required'));

assert.ok(restore.includes('assertTestDatabaseAuthority'));
assert.ok(restore.includes('SCHEMA_PROVISIONING_APPROVAL'));
assert.ok(restore.includes('RECOVERY_SCHEMA_PROVISIONING_APPROVAL'));
assert.ok(restore.includes('shell: false'));
assert.ok(restore.includes('--schema-snapshot'));
assert.ok(restore.includes('runSchemaSnapshotRestore'));
assert.ok(restore.includes('Refusing to use Prisma db push for Recovery restore'));
assert.ok(restore.includes('ON_ERROR_STOP=1'));
assert.ok(restore.includes('schema snapshot will recreate it'));

const schemaCapture = read('recovery/captureSchemaSnapshot.js');
assert.ok(schemaCapture.includes('--schema-only'));
assert.ok(schemaCapture.includes('--schema=public'));
assert.ok(schemaCapture.includes('databaseModified: false'));
assert.ok(schemaCapture.includes('PG_DUMP_PATH'));

assert.ok(verifier.includes('assertTestDatabaseAuthority'));
assert.ok(verifier.includes('BEGIN READ ONLY'));
assert.ok(verifier.includes('Missing --manifest path'));
assert.ok(verifier.includes('databaseModified: false'));
assert.ok(!verifier.includes('DIRECT_URL || process.env.DATABASE_URL'));
assert.ok(!verifier.includes('Collecting Production snapshot'));

assert.ok(uploader.includes('HeadObjectCommand'));
assert.ok(uploader.includes('remoteSha256'));
assert.ok(uploader.includes('remoteSizeBytes'));

console.log('recovery workflow safety contract: PASS');
