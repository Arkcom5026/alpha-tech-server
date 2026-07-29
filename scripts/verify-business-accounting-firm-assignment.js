'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const documentPath = path.join(root, 'docs/architecture/p1-business-accounting-firm-assignment.md');
const contractPath = path.join(
  root,
  'src/modules/access/contracts/businessAccountingFirmAssignment.contract.js'
);

assert.ok(fs.existsSync(documentPath), 'assignment architecture document must exist');
assert.ok(fs.existsSync(contractPath), 'assignment machine-readable contract must exist');

const documentText = fs.readFileSync(documentPath, 'utf8');
const contractModule = require(contractPath);
const contract = contractModule.businessAccountingFirmAssignmentContract;

assert.strictEqual(contract.version, 'P1_STEP_4_V1');
assert.strictEqual(contract.aggregate.name, 'BusinessAccountingFirmAssignment');
assert.strictEqual(contract.aggregate.businessOwnerAggregate, 'Business');
assert.strictEqual(contract.aggregate.assignedOrganizationAggregate, 'ExternalOrganization');
assert.strictEqual(contract.aggregate.requiredOrganizationType, 'ACCOUNTING_FIRM');

for (const status of [
  'PENDING_ACCEPTANCE',
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
  'EXPIRED',
  'DECLINED',
]) {
  assert.ok(contract.statuses.includes(status), `missing assignment status: ${status}`);
}

for (const status of ['REVOKED', 'EXPIRED', 'DECLINED']) {
  assert.ok(contract.terminalStatuses.includes(status), `missing terminal status: ${status}`);
  assert.deepStrictEqual(contract.transitions[status], [], `${status} must not reactivate`);
}

assert.ok(contract.transitions.PENDING_ACCEPTANCE.includes('ACTIVE'));
assert.ok(contract.transitions.PENDING_ACCEPTANCE.includes('DECLINED'));
assert.ok(contract.transitions.ACTIVE.includes('SUSPENDED'));
assert.ok(contract.transitions.ACTIVE.includes('REVOKED'));
assert.ok(contract.transitions.SUSPENDED.includes('ACTIVE'));

assert.deepStrictEqual(
  contract.authority.businessRolesThatMayRequestOrRevoke,
  ['OWNER', 'ADMIN']
);
assert.deepStrictEqual(
  contract.authority.organizationRolesThatMayAcceptOrDecline,
  ['OWNER', 'ADMIN']
);
assert.strictEqual(contract.authority.clientIdentifiersAreSelectorsOnly, true);
assert.strictEqual(contract.authority.databaseRevalidationRequired, true);

assert.strictEqual(contract.ownership.businessOwnsClientData, true);
assert.strictEqual(contract.ownership.externalOrganizationOwnsClientData, false);
assert.strictEqual(contract.ownership.externalOrganizationCanSelfAssign, false);
assert.strictEqual(contract.ownership.businessRevocationRequiresOrganizationApproval, false);

assert.strictEqual(contract.effectiveAccess.requiresActiveAssignment, true);
assert.strictEqual(contract.effectiveAccess.requiresActivePermissionScope, true);
assert.strictEqual(contract.effectiveAccess.assignmentAloneGrantsPermission, false);
assert.strictEqual(contract.effectiveAccess.permissionSurvivesIneffectiveAssignment, false);
assert.strictEqual(contract.effectiveAccess.denyOnMissingOrAmbiguousAuthority, true);

assert.strictEqual(contract.effectivePeriod.requiresEffectiveFromReached, true);
assert.strictEqual(contract.effectivePeriod.deniesAtOrAfterEffectiveUntil, true);
assert.strictEqual(contract.effectivePeriod.requiresActiveBusiness, true);
assert.strictEqual(contract.effectivePeriod.requiresActiveExternalOrganization, true);
assert.strictEqual(contract.effectivePeriod.requiresOrganizationAcceptance, true);

assert.strictEqual(contract.revocation.immediateAuthority, true);
assert.strictEqual(contract.revocation.failClosed, true);
assert.strictEqual(contract.revocation.preservesAssignmentHistory, true);
assert.strictEqual(contract.revocation.preservesPermissionHistory, true);
assert.strictEqual(contract.revocation.preservesAuditEvidence, true);

for (const invariant of [
  'BUSINESS_REMAINS_DATA_OWNER',
  'ASSIGNMENT_NEVER_IMPLIES_PERMISSION',
  'PERMISSION_REQUIRES_EFFECTIVE_ASSIGNMENT',
  'CROSS_BUSINESS_ACCESS_DENIED_BY_DEFAULT',
  'CROSS_ORGANIZATION_ASSIGNMENT_USE_DENIED',
  'BRANCH_SCOPE_CANNOT_EXCEED_ASSIGNED_BUSINESS',
  'REVOCATION_IS_FAIL_CLOSED',
  'TERMINAL_ASSIGNMENT_CANNOT_REACTIVATE',
]) {
  assert.ok(contract.isolationInvariants.includes(invariant), `missing invariant: ${invariant}`);
}

for (const event of [
  'ASSIGNMENT_REQUESTED',
  'ASSIGNMENT_ACCEPTED',
  'ASSIGNMENT_DECLINED',
  'ASSIGNMENT_ACTIVATED',
  'ASSIGNMENT_SUSPENDED',
  'ASSIGNMENT_RESUMED',
  'ASSIGNMENT_REVOKED',
  'ASSIGNMENT_EXPIRED',
]) {
  assert.ok(contract.auditEvents.includes(event), `missing audit event: ${event}`);
}

for (const phrase of [
  'Assignment does not grant permission',
  'Business revocation is immediately authoritative',
  'External Organization does not own client Business data',
  'P1 Step 5 — Permission Scope',
]) {
  assert.ok(documentText.includes(phrase), `document missing required authority phrase: ${phrase}`);
}

console.log('P1 Step 4 Business-to-Accounting-Firm Assignment repository verification: PASS');
