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
];

for (const file of files) {
  expect(fs.existsSync(path.join(root, file)), `Missing ${file}`);
}

const service = read(files[0]);
const repository = read(files[1]);
const routes = read(files[3]);

for (const denialCode of [
  'ACCOUNTANT_WORKSPACE_MEMBERSHIP_REQUIRED',
  'ACCOUNTANT_WORKSPACE_MEMBERSHIP_INACTIVE',
  'ACCOUNTANT_WORKSPACE_ASSIGNMENT_NOT_FOUND',
  'ACCOUNTANT_WORKSPACE_ASSIGNMENT_INACTIVE',
  'ACCOUNTANT_WORKSPACE_ASSIGNMENT_NOT_STARTED',
  'ACCOUNTANT_WORKSPACE_ASSIGNMENT_EXPIRED',
]) {
  expect(service.includes(denialCode), `Missing fail-closed denial code ${denialCode}`);
}

expect(repository.includes("status: 'ACTIVE'"), 'Repository must filter active authority');
expect(repository.includes("type: 'ACCOUNTING_FIRM'"), 'Repository must require accounting-firm organization');
expect(repository.includes('permissionScopes'), 'Repository must project delegated permission scopes');
expect(repository.includes('branches'), 'Repository must project business branches');
expect(routes.includes("router.use(verifyToken)"), 'Workspace routes must require authentication');
expect(routes.includes("router.get("), 'Workspace must expose read-only routes');
expect(!routes.includes('router.post('), 'Foundation workspace must not expose write routes');
expect(!routes.includes('router.patch('), 'Foundation workspace must not expose write routes');
expect(!routes.includes('router.delete('), 'Foundation workspace must not expose write routes');

console.log('Accountant Review Workspace repository verification: PASS');
