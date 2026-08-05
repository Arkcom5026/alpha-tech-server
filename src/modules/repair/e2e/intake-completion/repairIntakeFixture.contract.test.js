'use strict';

const fs = require('fs');
const path = require('path');

const fixture = fs.readFileSync(path.join(__dirname, 'provisionRepairIntakeFixture.js'), 'utf8');
const authority = fs.readFileSync(path.join(__dirname, 'repairIntakeE2ERuntimeAuthority.js'), 'utf8');

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

assert(authority.includes("TEST_DB: 'TEST_DB'"), 'Test DB mode must remain available.');
assert(authority.includes("MAIN_TEST_TENANT: 'MAIN_TEST_TENANT'"), 'Main test-tenant mode must be explicit.');
assert(authority.includes('branchId: 13'), 'Main test tenant must be fixed to branchId 13.');
assert(authority.includes("branchSlug: 'test-shop'"), 'Main test tenant slug must be fixed.');
assert(authority.includes('assertTestDatabaseAuthority'), 'Legacy Test DB mode must retain authority checks.');
assert(authority.includes('ALPHATECH_MAIN_DB_TEST_TENANT_WRITE'), 'Main mode must require explicit write approval.');
assert(fixture.includes('authority.mayMutateOperatorCredential'), 'Operator handling must be mode-controlled.');
assert(fixture.includes('externalRepository.findCustomer(branch.id, customerId)'), 'Customer lookup must be branch-scoped.');
assert(fixture.includes('authority.expectedBranch.branchId'), 'Fixture must enforce the fixed Main branch.');
assert(fixture.includes('CreateExternalDeviceIntakeService'), 'Fixture must use the real external-intake service.');

const outputStart = fixture.indexOf('console.log(JSON.stringify({');
assert(outputStart >= 0, 'Fixture must emit structured JSON.');
const outputSource = fixture.slice(outputStart);
assert(!outputSource.includes('operatorPassword'), 'Fixture output must not expose operator secrets.');

console.log('Repair intake E2E fixture contract: PASS');
