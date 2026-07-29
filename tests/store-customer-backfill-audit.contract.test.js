'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
const migration = fs.readFileSync(
  path.join(root, 'prisma/migrations/20260729200000_add_store_customer_backfill_audit_foundation/migration.sql'),
  'utf8',
);

assert.match(schema, /model StoreCustomerBackfillRun \{/);
assert.match(schema, /model StoreCustomerBackfillCandidate \{/);
assert.match(schema, /model StoreCustomerBackfillDecision \{/);
assert.match(schema, /legacyCustomerProfileId\s+Int/);
assert.match(schema, /branchId\s+Int/);
assert.match(schema, /@@unique\(\[backfillRunId, legacyCustomerProfileId, branchId\]\)/);
assert.match(schema, /decisions\s+StoreCustomerBackfillDecision\[\]/);
assert.match(schema, /candidate\s+StoreCustomerBackfillCandidate/);
assert.match(schema, /enum StoreCustomerBackfillRunStatus \{/);
assert.match(schema, /enum StoreCustomerBackfillCandidateStatus \{/);
assert.match(schema, /enum StoreCustomerBackfillDecisionAction \{/);
assert.match(schema, /model CustomerProfile \{/);
assert.match(schema, /storeCustomerBackfillCandidates\s+StoreCustomerBackfillCandidate\[\]/);
assert.match(migration, /CREATE TABLE "StoreCustomerBackfillRun"/);
assert.match(migration, /CREATE TABLE "StoreCustomerBackfillCandidate"/);
assert.match(migration, /CREATE TABLE "StoreCustomerBackfillDecision"/);
assert.match(migration, /ON DELETE RESTRICT ON UPDATE CASCADE/);
assert.match(migration, /ON DELETE CASCADE ON UPDATE CASCADE/);
assert.doesNotMatch(migration, /^\s*(?:INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM)\b/im);
assert.doesNotMatch(migration, /ALTER TABLE "CustomerProfile"/);
assert.doesNotMatch(migration, /StoreCustomerIdentityLink"\s*\(/);

console.log('Store Customer Backfill and Audit Foundation contract: PASS');
