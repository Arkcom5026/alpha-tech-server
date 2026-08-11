const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(path.join(__dirname, 'migration.sql'), 'utf8');

test('repair subcontract migration is additive and branch-owned', () => {
  assert.match(migration, /CREATE TABLE "RepairSubcontract"/);
  assert.match(migration, /"branchId" INTEGER NOT NULL/);
  assert.match(migration, /"repairJobId" INTEGER NOT NULL/);
  assert.match(migration, /"sentByEmployeeId" INTEGER NOT NULL/);
  assert.match(migration, /"returnedByEmployeeId" INTEGER/);
});

test('repair subcontract migration keeps pricing flexible and separate from customer final price', () => {
  assert.match(migration, /"customerEstimateAmount" DECIMAL\(12,2\)/);
  assert.match(migration, /"customerApprovalNote" TEXT/);
  assert.match(migration, /"providerQuotedAmount" DECIMAL\(12,2\)/);
  assert.match(migration, /"customerDecisionNote" TEXT/);
  assert.match(migration, /"actualExternalCost" DECIMAL\(12,2\)/);
});

test('repair subcontract migration permits only one active custody record per repair job', () => {
  assert.match(migration, /RepairSubcontract_one_active_per_job_key/);
  assert.match(migration, /WHERE "status" IN \('SENT', 'RETURN_REQUESTED'\)/);
  assert.match(migration, /CHECK \("status" IN \('SENT', 'RETURN_REQUESTED', 'RETURNED'\)\)/);
});
