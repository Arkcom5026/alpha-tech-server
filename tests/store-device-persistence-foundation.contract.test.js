'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readPrismaSchemaSource } = require('../scripts/read-prisma-schema-source');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const schema = readPrismaSchemaSource(root);
const migration = read('prisma/migrations/20260804170000_store_device_persistence_foundation/migration.sql');

const model = (name) => {
  const match = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `Missing ${name} model`);
  return match[1];
};

const normalized = (value) => value.replace(/\s+/g, ' ');
const branch = model('Branch');
const gateway = model('StoreDeviceGateway');
const session = model('StoreDeviceGatewaySession');
const job = model('StoreDeviceJob');
const lease = model('StoreDeviceJobLease');
const result = model('StoreDeviceJobResult');

for (const [field, type] of [
  ['storeDeviceGateways', 'StoreDeviceGateway'],
  ['storeDeviceGatewaySessions', 'StoreDeviceGatewaySession'],
  ['storeDeviceJobs', 'StoreDeviceJob'],
  ['storeDeviceJobLeases', 'StoreDeviceJobLease'],
  ['storeDeviceJobResults', 'StoreDeviceJobResult'],
]) {
  assert.match(branch, new RegExp(`\\n\\s+${field}\\s+${type}\\[\\]`), `Missing Branch reverse relation: ${field}`);
}

for (const [name, body] of Object.entries({
  StoreDeviceGateway: gateway,
  StoreDeviceGatewaySession: session,
  StoreDeviceJob: job,
  StoreDeviceJobLease: lease,
  StoreDeviceJobResult: result,
})) {
  assert.match(body, /\n\s+branchId\s+Int\b/, `${name} must require branchId`);
  assert.match(body, /branch\s+Branch\s+@relation\(fields: \[branchId\]/, `${name} must relate to Branch`);
}

for (const enumName of [
  'StoreDeviceGatewayEnrollmentState',
  'StoreDeviceGatewayRuntimeState',
  'StoreDeviceGatewaySessionState',
  'StoreDeviceJobType',
  'StoreDeviceJobStatus',
  'StoreDeviceJobLeaseStatus',
  'StoreDeviceJobResultStatus',
]) {
  assert.match(schema, new RegExp(`enum ${enumName} \\{`), `Missing lifecycle enum: ${enumName}`);
  assert.match(migration, new RegExp(`CREATE TYPE "${enumName}"`), `Migration must create enum: ${enumName}`);
}

assert.match(gateway, /@@unique\(\[branchId, gatewayId\]\)/);
assert.match(session, /@@unique\(\[branchId, sessionId\]\)/);
assert.match(job, /@@unique\(\[branchId, jobId\]\)/);
assert.match(job, /@@unique\(\[branchId, idempotencyKey\]\)/);
assert.match(lease, /@@unique\(\[branchId, leaseId\]\)/);
assert.match(lease, /@@unique\(\[jobId, attemptNumber\]\)/);
assert.match(result, /@@unique\(\[branchId, resultId\]\)/);
assert.match(result, /@@unique\(\[branchId, leaseId\]\)/);
assert.match(result, /leaseId\s+Int\s+@unique/);

for (const body of [session, lease, result]) {
  assert.match(normalized(body), /fields: \[branchId, gatewayId\], references: \[branchId, id\]/);
}
for (const body of [lease, result]) {
  assert.match(normalized(body), /fields: \[branchId, gatewayId, sessionId\], references: \[branchId, gatewayId, id\]/);
}
for (const body of [lease, result]) {
  assert.match(normalized(body), /fields: \[branchId, jobId\], references: \[branchId, id\]/);
}
assert.match(normalized(result), /fields: \[branchId, leaseId\], references: \[branchId, id\]/);

assert.match(migration, /StoreDeviceJobLease_one_active_job_key/);
assert.match(migration, /StoreDeviceJobLease_branchId_gatewayId_sessionId_fkey/);
assert.match(migration, /StoreDeviceJobResult_branchId_leaseId_fkey/);
assert.match(migration, /WHERE "status" IN \('OFFERED', 'ACKNOWLEDGED'\)/);
assert.match(migration, /prevent_store_device_job_result_mutation/);
assert.match(migration, /BEFORE UPDATE OR DELETE ON "StoreDeviceJobResult"/);
assert.match(migration, /prevent_revoked_store_device_lease/);
assert.match(migration, /StoreDeviceJobLease_reject_revoked_authority/);
assert.match(migration, /A revoked gateway or session cannot obtain a device job lease/);

for (const name of [
  'StoreDeviceGateway',
  'StoreDeviceGatewaySession',
  'StoreDeviceJob',
  'StoreDeviceJobLease',
  'StoreDeviceJobResult',
]) {
  assert.match(migration, new RegExp(`CREATE TABLE "${name}"`));
}

assert.doesNotMatch(migration, /\bDROP\s+(?:TABLE|TYPE|SCHEMA|INDEX|COLUMN)\b/i);
assert.doesNotMatch(migration, /\b(?:DELETE\s+FROM|TRUNCATE|UPDATE\s+"(?:StoreDevice|Branch))/i);
assert.doesNotMatch(migration, /UNIQUE \([^)]*"(?:gatewayId|sessionId|jobId|idempotencyKey|leaseId|resultId)"\)/);
assert.doesNotMatch(`${schema}\n${migration}`, /(?:proofKey|privateKey|credential(?:Value|Secret)?|accessToken|refreshToken|certificate)\s+(?:String|TEXT)/i);

console.log('store device persistence foundation contract: PASS');
