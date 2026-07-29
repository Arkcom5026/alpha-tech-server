'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

const files = [
  'src/modules/professional-access/accountant-workspace/accountantWorkspaceService.js',
  'src/modules/professional-access/accountant-workspace/accountantWorkspaceRepository.js',
  'src/modules/professional-access/accountant-workspace/accountantWorkspaceController.js',
  'src/modules/professional-access/accountant-workspace/accountantWorkspaceRoutes.js',
  'src/modules/professional-access/accountant-workspace/index.js',
  'src/modules/professional-access/shared/professionalAccessAuthority.js',
  'src/modules/professional-access/contracts/professionalAccess.contract.js',
];

for (const file of files) {
  expect(fs.existsSync(path.join(root, file)), `Missing ${file}`);
}

const service = read(files[0]);
const repository = read(files[1]);
const routes = read(files[3]);
const authority = read(files[5]);
const contract = require(path.join(root, files[6]));

expect(
  service.includes("codePrefix: 'ACCOUNTANT_WORKSPACE'"),
  'Workspace service must use ACCOUNTANT_WORKSPACE authority prefix',
);

const requiredCodes = {
  USER_REQUIRED: 'ACCOUNTANT_WORKSPACE_USER_REQUIRED',
  ORGANIZATION_REQUIRED: 'ACCOUNTANT_WORKSPACE_ORGANIZATION_REQUIRED',
  BUSINESS_REQUIRED: 'ACCOUNTANT_WORKSPACE_BUSINESS_REQUIRED',
  MEMBERSHIP_REQUIRED: 'ACCOUNTANT_WORKSPACE_MEMBERSHIP_REQUIRED',
  MEMBERSHIP_INACTIVE: 'ACCOUNTANT_WORKSPACE_MEMBERSHIP_INACTIVE',
  ASSIGNMENT_REQUIRED: 'ACCOUNTANT_WORKSPACE_ASSIGNMENT_REQUIRED',
  ASSIGNMENT_INACTIVE: 'ACCOUNTANT_WORKSPACE_ASSIGNMENT_INACTIVE',
  ASSIGNMENT_NOT_STARTED: 'ACCOUNTANT_WORKSPACE_ASSIGNMENT_NOT_STARTED',
  ASSIGNMENT_EXPIRED: 'ACCOUNTANT_WORKSPACE_ASSIGNMENT_EXPIRED',
  PERMISSION_DENIED: 'ACCOUNTANT_WORKSPACE_PERMISSION_DENIED',
  BRANCH_INVALID: 'ACCOUNTANT_WORKSPACE_BRANCH_INVALID',
};

for (const [key, code] of Object.entries(requiredCodes)) {
  expect(
    contract.ACCOUNTANT_WORKSPACE_ERROR_CODES?.[key] === code,
    `Missing public Accountant Workspace error code ${code}`,
  );
}

for (const suffix of [
  '_USER_REQUIRED',
  '_ORGANIZATION_REQUIRED',
  '_BUSINESS_REQUIRED',
  '_MEMBERSHIP_REQUIRED',
  '_MEMBERSHIP_INACTIVE',
  '_ASSIGNMENT_REQUIRED',
  '_ASSIGNMENT_INACTIVE',
  'ASSIGNMENT_NOT_STARTED',
  'ASSIGNMENT_EXPIRED',
  '_PERMISSION_DENIED',
  '_BRANCH_INVALID',
]) {
  expect(authority.includes(suffix), `Shared authority must generate suffix ${suffix}`);
}

expect(repository.includes("status: 'ACTIVE'"), 'Repository must filter active authority');
expect(repository.includes("type: 'ACCOUNTING_FIRM'"), 'Repository must require accounting-firm organization');
expect(repository.includes('permissionScopes'), 'Repository must project delegated permission scopes');
expect(repository.includes('branches'), 'Repository must project business branches');
expect(routes.includes('router.use(verifyToken)'), 'Workspace routes must require authentication');
expect(routes.includes('router.get('), 'Workspace must expose read-only routes');
expect(!routes.includes('router.post('), 'Foundation workspace must not expose write routes');
expect(!routes.includes('router.patch('), 'Foundation workspace must not expose write routes');
expect(!routes.includes('router.delete('), 'Foundation workspace must not expose write routes');

console.log('Accountant Review Workspace repository verification: PASS');
