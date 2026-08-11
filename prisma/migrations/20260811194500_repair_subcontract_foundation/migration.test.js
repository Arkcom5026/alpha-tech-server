const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(path.join(__dirname, 'migration.sql'), 'utf8');
const schemaVerifier = fs.readFileSync(
  path.join(__dirname, '../../../scripts/verify-repair-subcontract-schema.js'),
  'utf8'
);

test('repair subcontract migration is additive and branch-owned', () => {
  assert.match(migration, /CREATE TABLE "RepairSubcontract"/);
  assert.match(migration, /"branchId" INTEGER NOT NULL/);
  assert.match(migration, /"repairJobId" INTEGER NOT NULL/);
  assert.match(migration, /"sentByEmployeeId" INTEGER NOT NULL/);
  assert.match(migration, /"returnedByEmployeeId" INTEGER/);
});

test('repair subcontract migration enforces tenant, job and employee ownership with foreign keys', () => {
  assert.match(migration, /CONSTRAINT "RepairSubcontract_branchId_fkey"/);
  assert.match(migration, /FOREIGN KEY \("branchId"\) REFERENCES "Branch"\("id"\) ON DELETE RESTRICT/);
  assert.match(migration, /CONSTRAINT "RepairSubcontract_repairJobId_fkey"/);
  assert.match(migration, /FOREIGN KEY \("repairJobId"\) REFERENCES "RepairJob"\("id"\) ON DELETE CASCADE/);
  assert.match(migration, /CONSTRAINT "RepairSubcontract_sentByEmployeeId_fkey"/);
  assert.match(migration, /FOREIGN KEY \("sentByEmployeeId"\) REFERENCES "EmployeeProfile"\("id"\) ON DELETE RESTRICT/);
  assert.match(migration, /CONSTRAINT "RepairSubcontract_returnedByEmployeeId_fkey"/);
  assert.match(migration, /FOREIGN KEY \("returnedByEmployeeId"\) REFERENCES "EmployeeProfile"\("id"\) ON DELETE SET NULL/);
  assert.match(migration, /RepairSubcontract_sentByEmployeeId_idx/);
  assert.match(migration, /RepairSubcontract_returnedByEmployeeId_idx/);
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

test('repair subcontract schema verification is repository-owned and checks live database authority', () => {
  assert.match(schemaVerifier, /RepairSubcontract table not found in public schema/);
  assert.match(schemaVerifier, /REQUIRED_CONSTRAINTS/);
  assert.match(schemaVerifier, /REQUIRED_INDEXES/);
  assert.match(schemaVerifier, /RepairSubcontract_one_active_per_job_key/);
  assert.match(schemaVerifier, /REPAIR SUBCONTRACT SCHEMA VERIFICATION: PASS/);
});
