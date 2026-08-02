'use strict';

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, 'verifyRepairIntakeOutcome.js'),
  'utf8'
);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(source.includes('assertTestDatabaseAuthority'), 'Verifier must assert Test DB authority.');
assert(source.includes("databaseModified: false"), 'Verifier must report read-only authority.');
assert(source.includes("status !== 'IN_PROGRESS'"), 'Verifier must require IN_PROGRESS.');
assert(source.includes('deviceIntake'), 'Verifier must inspect singular DeviceIntake evidence.');
assert(source.includes('INTAKE_CONDITION'), 'Verifier must require intake-condition photo evidence.');
assert(source.includes('RepairJobEvent'), 'Verifier must inspect the status timeline event.');
assert(
  !source.includes('.create(') && !source.includes('.update(') && !source.includes('.delete('),
  'Verifier must not contain Prisma write operations.'
);

console.log('Repair intake E2E outcome contract: PASS');
