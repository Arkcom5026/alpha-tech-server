'use strict';

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'verifyRepairIntakeOutcome.js'), 'utf8');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(source.includes('resolveRepairIntakeE2ERuntimeAuthority'), 'Verifier must use shared runtime authority.');
assert(source.includes('databaseModified: false'), 'Verifier must report read-only authority.');
assert(source.includes('authority.expectedBranch.branchId'), 'Verifier must enforce the fixed Main test tenant.');
assert(source.includes("status !== 'IN_PROGRESS'"), 'Verifier must require IN_PROGRESS.');
assert(source.includes('deviceIntake'), 'Verifier must inspect DeviceIntake evidence.');
assert(source.includes('INTAKE_CONDITION'), 'Verifier must require intake-condition photo evidence.');
assert(source.includes('RepairWorkflowEvent'), 'Verifier must inspect the canonical workflow event.');
assert(source.includes("targetStatus\" = 'REPAIRING'"), 'Verifier must require the canonical REPAIRING transition.');
assert(
  !source.includes('.create(') && !source.includes('.update(') && !source.includes('.delete('),
  'Verifier must not contain Prisma write operations.'
);

console.log('Repair intake E2E outcome contract: PASS');
