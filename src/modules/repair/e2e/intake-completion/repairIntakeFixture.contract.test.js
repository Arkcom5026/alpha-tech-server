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
  source.includes('externalRepository.findCustomer(branch.id, customerId)'),
  'Fixture customer must use the runtime branch-authority lookup.'
);
assert(
  !source.includes('customerProfile.findFirst'),
  'Fixture must not duplicate obsolete CustomerProfile branch scoping.'
);
assert(
  source.includes('CreateExternalDeviceIntakeService'),
  'Fixture must use the real repair external-intake service.'
);

const outputStart = source.indexOf('console.log(JSON.stringify({');
assert(outputStart >= 0, 'Fixture must emit a structured JSON result.');
const outputSource = source.slice(outputStart);
assert(
  !outputSource.includes('operatorPassword') && !outputSource.includes('E2E_TEST_PASSWORD'),
  'Fixture output must not expose the operator password.'
);

assert(
  !source.includes('PRODUCTION_DATABASE_URL'),
  'Fixture must not introduce a production database path.'
);

console.log('Repair intake E2E fixture contract: PASS');
