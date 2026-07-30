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

assert.match(runner, /RECOVERY_DRILL_APPROVAL/);
assert.match(runner, /RECOVERY_RETENTION_APPLY_APPROVAL/);
assert.match(runner, /RECOVERY_R2_RETENTION_APPLY_APPROVAL/);
assert.match(runner, /openSync(LOCK_FILE,s*'wx')/);
assert.match(runner, /shell:s*false/);
assert.ok(runner.includes('recovery/verify/qbv.js not found; recovery cannot be certified'));
assert.ok(runner.includes('R2_PREFIX/S3_PREFIX is required'));

assert.match(restore, /assertTestDatabaseAuthority/);
assert.match(restore, /SCHEMA_PROVISIONING_APPROVAL/);
assert.match(restore, /RECOVERY_SCHEMA_PROVISIONING_APPROVAL/);
assert.match(restore, /shell:s*false/);
assert.match(restore, /npx.cmd/);

assert.match(verifier, /assertTestDatabaseAuthority/);
assert.match(verifier, /BEGIN READ ONLY/);
assert.match(verifier, /Missing --manifest path/);
assert.match(verifier, /databaseModified:s*false/);
assert.doesNotMatch(verifier, /DIRECT_URLs*||s*process.env.DATABASE_URL/);
assert.doesNotMatch(verifier, /Collecting Production snapshot/);

assert.match(uploader, /HeadObjectCommand/);
assert.match(uploader, /remoteSha256/);
assert.match(uploader, /remoteSizeBytes/);

console.log('recovery workflow safety contract: PASS');
