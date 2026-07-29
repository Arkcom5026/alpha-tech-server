'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const documentPath = path.join(root, 'docs/architecture/p1-permission-scope-contract.md');
const contractPath = path.join(
  root,
  'src/modules/access/contracts/permissionScope.contract.js',
);

const fail = (message) => {
  console.error(`PERMISSION_SCOPE_CONTRACT: FAIL — ${message}`);
  process.exit(1);
};

const assert = (condition, message) => {
  if (!condition) fail(message);
};

assert(fs.existsSync(documentPath), 'architecture document is missing');
assert(fs.existsSync(contractPath), 'machine-readable contract is missing');

const document = fs.readFileSync(documentPath, 'utf8');
const contract = require(contractPath);

assert(contract.contract === 'PERMISSION_SCOPE_V1', 'unexpected contract version');
assert(contract.tenantOwner === 'BUSINESS', 'Business must remain tenant owner');
assert(contract.aggregate === 'DELEGATED_PERMISSION_SCOPE', 'unexpected aggregate');

for (const status of ['DRAFT', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED']) {
  assert(contract.statuses.includes(status), `missing status ${status}`);
}

for (const status of ['REVOKED', 'EXPIRED']) {
  assert(contract.terminalStatuses.includes(status), `missing terminal status ${status}`);
}

for (const resource of [
  'INPUT_TAX',
  'OUTPUT_TAX',
  'TAX_FILING_BATCH',
  'PAYABLE',
  'RECEIVABLE',
  'AUDIT_EVENT',
]) {
  assert(contract.resources.includes(resource), `missing resource ${resource}`);
}

for (const action of [
  'READ',
  'REVIEW',
  'COMMENT',
  'EXPORT',
  'SUBMIT_FOR_BUSINESS_APPROVAL',
  'FILE',
]) {
  assert(contract.actions.includes(action), `missing action ${action}`);
}

for (const mode of [
  'ALL_BUSINESS_BRANCHES',
  'SELECTED_BRANCHES',
  'NO_BRANCH_CONTEXT',
]) {
  assert(contract.branchModes.includes(mode), `missing branch mode ${mode}`);
}

assert(
  contract.grantAuthority.businessRoles.join(',') === 'OWNER,ADMIN',
  'grant authority must be limited to Business OWNER and ADMIN',
);
assert(contract.grantAuthority.organizationSelfGrant === false, 'organization self-grant must be forbidden');
assert(contract.invariants.denyByDefault === true, 'deny-by-default invariant is missing');
assert(contract.invariants.leastPrivilege === true, 'least-privilege invariant is missing');
assert(
  contract.invariants.assignmentAloneGrantsAccess === false,
  'assignment must not grant access by itself',
);
assert(
  contract.invariants.organizationMembershipAloneGrantsAccess === false,
  'organization membership must not grant Business access by itself',
);
assert(contract.invariants.crossBusinessAccess === 'DENY', 'cross-Business access must be denied');
assert(contract.invariants.crossOrganizationAccess === 'DENY', 'cross-Organization access must be denied');
assert(contract.invariants.readImpliesExport === false, 'READ must not imply EXPORT');
assert(
  contract.invariants.reviewImpliesMutationOrFiling === false,
  'REVIEW must not imply mutation or filing',
);
assert(
  contract.invariants.unknownRegistryValuesFailClosed === true,
  'unknown registry values must fail closed',
);
assert(
  contract.invariants.legacyBranchProjectionIsDelegatedAuthority === false,
  'legacy branch projection must not become delegated authority',
);

for (const code of [
  'ASSIGNMENT_NOT_EFFECTIVE',
  'PERMISSION_SCOPE_REQUIRED',
  'ACTION_NOT_GRANTED',
  'BRANCH_NOT_GRANTED',
  'BUSINESS_APPROVAL_REQUIRED',
  'AUTHORITY_CONTEXT_MISMATCH',
]) {
  assert(contract.denialCodes.includes(code), `missing denial code ${code}`);
}

for (const phrase of [
  'deny-by-default',
  'least-privilege',
  'Assignment alone grants no Business-data permission',
  'Client identifiers are selectors only',
  'P1 Step 6 — Professional Access Prisma Foundation',
]) {
  assert(document.includes(phrase), `architecture document is missing phrase: ${phrase}`);
}

console.log('PERMISSION_SCOPE_CONTRACT: PASS');
