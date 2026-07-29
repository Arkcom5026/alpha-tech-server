'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const docPath = path.join(root, 'docs/architecture/p1-business-ownership-contract.md');
const contractPath = path.join(
  root,
  'src/modules/access/contracts/businessOwnership.contract.js',
);

assert.ok(fs.existsSync(docPath), 'Business ownership architecture document is missing');
assert.ok(fs.existsSync(contractPath), 'Business ownership contract is missing');

const doc = fs.readFileSync(docPath, 'utf8');
const contract = require(contractPath);

assert.strictEqual(
  contract.BUSINESS_OWNERSHIP_CONTRACT_VERSION,
  'BUSINESS_OWNERSHIP_V1',
);
assert.strictEqual(contract.businessOwnershipContract.tenantAggregate, 'BUSINESS');
assert.strictEqual(contract.businessOwnershipContract.locationAggregate, 'BRANCH');
assert.strictEqual(
  contract.businessOwnershipContract.membershipAggregate,
  'BUSINESS_MEMBERSHIP',
);
assert.strictEqual(contract.businessOwnershipContract.legacyCompatibility.branchAsTenant, false);

for (const role of ['OWNER', 'ADMIN', 'MANAGER', 'STAFF', 'VIEWER']) {
  assert.ok(contract.BUSINESS_ROLES.includes(role), `Missing Business role: ${role}`);
}

for (const field of [
  'userId',
  'platformRole',
  'businessId',
  'businessMembershipId',
  'businessRole',
  'branchIds',
  'activeBranchId',
  'authoritySource',
]) {
  assert.ok(
    contract.REQUEST_AUTHORITY_FIELDS.includes(field),
    `Missing request authority field: ${field}`,
  );
}

for (const invariant of [
  'BUSINESS_IS_FIRST_CLASS_TENANT_AND_DATA_OWNER',
  'BRANCH_BELONGS_TO_EXACTLY_ONE_BUSINESS',
  'CLIENT_IDENTIFIERS_ARE_SELECTORS_NOT_AUTHORITY',
  'DATABASE_REVALIDATION_REQUIRED',
  'CROSS_BUSINESS_ACCESS_DENIED_BY_DEFAULT',
  'EXTERNAL_ORGANIZATIONS_RECEIVE_DELEGATED_ACCESS_ONLY',
]) {
  assert.ok(
    contract.OWNERSHIP_INVARIANTS.includes(invariant),
    `Missing ownership invariant: ${invariant}`,
  );
}

for (const phrase of [
  'Business is the first-class tenant and data owner',
  'A Branch is a location or operational subdivision of one Business',
  'client-provided `businessId` or `branchId` is a selector',
  'External organizations receive delegated access',
  'No step may silently broaden access',
]) {
  assert.ok(doc.includes(phrase), `Architecture authority missing phrase: ${phrase}`);
}

assert.strictEqual(
  contract.businessOwnershipContract.nextStep,
  'P1_STEP_3_EXTERNAL_ORGANIZATION_FOUNDATION',
);

console.log('Business ownership contract verification: PASS');
