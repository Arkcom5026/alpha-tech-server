'use strict';

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, 'provisionRepairIntakeFixture.js'),
  'utf8'
);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(source.includes('assertTestDatabaseAuthority'), 'Fixture must assert Test DB authority.');
assert(source.includes('requiresWriteApproval: true'), 'Fixture must require explicit write approval.');
assert(
  source.includes('ALPHATECH_REPAIR_INTAKE_E2E_FIXTURE'),
  'Fixture approval token must remain explicit.'
);
assert(
  source.includes('customerProfile.findFirst') && source.includes('branchId: branch.id'),
  'Fixture customer must be scoped to the operator branch.'
);
assert(
  source.includes('CreateExternalDeviceIntakeService'),
  'Fixture must use the real repair external-intake service.'
);
assert(
  !source.includes('PRODUCTION_DATABASE_URL'),
  'Fixture must not introduce a production database path.'
);

console.log('Repair intake E2E fixture contract: PASS');
