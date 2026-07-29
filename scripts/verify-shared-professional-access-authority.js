const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

const files = {
  authority: 'src/modules/professional-access/shared/professionalAccessAuthority.js',
  workspaceService: 'src/modules/professional-access/accountant-workspace/accountantWorkspaceService.js',
  workspaceRepository: 'src/modules/professional-access/accountant-workspace/accountantWorkspaceRepository.js',
  taxReviewService: 'src/modules/professional-access/tax-review-collaboration/taxReviewService.js',
  taxReviewRepository: 'src/modules/professional-access/tax-review-collaboration/taxReviewRepository.js',
};

for (const file of Object.values(files)) {
  expect(fs.existsSync(path.join(root, file)), `Missing ${file}`);
}

const authority = read(files.authority);
const workspaceService = read(files.workspaceService);
const workspaceRepository = read(files.workspaceRepository);
const taxReviewService = read(files.taxReviewService);
const taxReviewRepository = read(files.taxReviewRepository);

for (const symbol of [
  'authorizeProfessionalAccess',
  'assertActiveMembership',
  'assertActiveAssignment',
  'assertPermission',
  'isWithinEffectiveWindow',
]) {
  expect(authority.includes(symbol), `Missing shared authority symbol ${symbol}`);
}

expect(
  authority.includes("branchMode === 'ALL_BUSINESS_BRANCHES'"),
  'Authority must support all-business branch scope',
);
expect(
  authority.includes("branchMode === 'NO_BRANCH_CONTEXT'"),
  'Authority must support no-branch scope',
);
expect(
  authority.includes("branchMode !== 'SELECTED_BRANCHES' || !branchId"),
  'Selected branch permission must fail closed without branchId',
);
expect(
  authority.includes('(scope.branchIds || []).map(Number).includes(Number(branchId))'),
  'Selected branch permission must verify branch membership',
);
expect(
  authority.includes('effectiveFrom') && authority.includes('effectiveUntil'),
  'Authority must enforce effective windows',
);

expect(
  workspaceService.includes("require('../shared/professionalAccessAuthority')"),
  'Accountant workspace must consume shared authority',
);
expect(
  workspaceRepository.includes('findActiveAssignment'),
  'Accountant workspace repository must expose the shared assignment adapter',
);
expect(
  taxReviewService.includes("require('../shared/professionalAccessAuthority')"),
  'Tax review must consume shared authority',
);
expect(
  taxReviewService.includes('loadReviewWithAuthority'),
  'Tax review mutations must load the review before branch authorization',
);
expect(
  taxReviewService.includes('branchId: review.branchId'),
  'Tax review mutations must authorize the persisted review branch',
);

for (const field of ['status: true', 'resource: true', 'effectiveFrom: true', 'effectiveUntil: true']) {
  expect(taxReviewRepository.includes(field), `Tax review authority projection missing ${field}`);
}

console.log('Shared Professional Access Authority repository verification: PASS');
