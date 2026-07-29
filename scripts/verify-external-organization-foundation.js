'use strict';

const assert = require('assert');
const {
  EXTERNAL_ORGANIZATION_FOUNDATION_V1,
} = require('../src/modules/access/contracts/externalOrganizationFoundation.contract');

const contract = EXTERNAL_ORGANIZATION_FOUNDATION_V1;

assert.strictEqual(contract.contract, 'EXTERNAL_ORGANIZATION_FOUNDATION_V1');
assert.strictEqual(contract.step, 3);
assert.strictEqual(contract.aggregate.name, 'ExternalOrganization');
assert.deepStrictEqual(contract.aggregate.organizationTypes, ['ACCOUNTING_FIRM']);
assert(contract.aggregate.statuses.includes('ACTIVE'));
assert(contract.aggregate.statuses.includes('SUSPENDED'));
assert(contract.aggregate.statuses.includes('CLOSED'));

assert.strictEqual(contract.membership.name, 'ExternalOrganizationMembership');
assert(contract.membership.roles.includes('OWNER'));
assert(contract.membership.roles.includes('PROFESSIONAL'));
assert(contract.membership.roles.includes('ASSISTANT'));
assert(contract.membership.statuses.includes('INVITED'));
assert(contract.membership.statuses.includes('ACTIVE'));
assert(contract.membership.statuses.includes('REVOKED'));

assert.strictEqual(contract.authority.organizationInternalOnly, true);
assert.strictEqual(contract.authority.databaseRevalidationRequired, true);
assert.strictEqual(contract.authority.clientIdentifiersAreSelectorsOnly, true);
assert.strictEqual(contract.authority.businessAccessFromOrganizationStatus, false);
assert.strictEqual(contract.authority.businessAccessFromMembershipRole, false);
assert.strictEqual(contract.authority.businessAccessRequiresExplicitAssignment, true);
assert.strictEqual(contract.authority.platformAuthoritySeparated, true);
assert.strictEqual(contract.authority.businessAuthoritySeparated, true);
assert.strictEqual(contract.authority.delegatedAuthoritySeparated, true);

assert(contract.ownership.organizationNeverOwns.includes('CLIENT_BUSINESS'));
assert(contract.ownership.organizationNeverOwns.includes('CLIENT_TAX_DOCUMENT'));
assert(contract.ownership.organizationNeverOwns.includes('CLIENT_OPERATIONAL_DATA'));
assert(contract.forbiddenWithoutAssignment.includes('READ_BUSINESS_DATA'));
assert(contract.forbiddenWithoutAssignment.includes('READ_TAX_DOCUMENTS'));
assert(contract.forbiddenWithoutAssignment.includes('FILE_TAX_FOR_BUSINESS'));

assert.strictEqual(contract.suspensionRules.suspendedOrganizationHasNoEffectiveDelegatedAccess, true);
assert.strictEqual(contract.suspensionRules.closedOrganizationHasNoEffectiveDelegatedAccess, true);
assert.strictEqual(contract.suspensionRules.suspendedMembershipHasNoEffectiveAuthority, true);
assert.strictEqual(contract.suspensionRules.revokedMembershipHasNoEffectiveAuthority, true);
assert.strictEqual(contract.suspensionRules.historicalEvidencePreserved, true);

assert(contract.auditEvents.includes('ORGANIZATION_CREATED'));
assert(contract.auditEvents.includes('MEMBER_ROLE_CHANGED'));
assert(contract.auditEvents.includes('MEMBER_REVOKED'));
assert(contract.explicitNonGoals.includes('BUSINESS_ASSIGNMENT'));
assert(contract.explicitNonGoals.includes('PERMISSION_SCOPE'));
assert.strictEqual(contract.nextStep, 'P1_STEP_4_BUSINESS_TO_ACCOUNTING_FIRM_ASSIGNMENT');

console.log('External Organization Foundation contract: PASS');
