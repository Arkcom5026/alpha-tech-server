const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

const requiredFiles = [
  'src/modules/professional-access/contracts/professionalAccess.contract.js',
  'src/modules/professional-access/shared/professionalAccessAuthority.js',
  'src/modules/professional-access/accountant-workspace/accountantWorkspaceRoutes.js',
  'src/modules/professional-access/accountant-workspace/accountantWorkspaceController.js',
  'src/modules/professional-access/accountant-workspace/accountantWorkspaceService.js',
  'src/modules/professional-access/accountant-workspace/accountantWorkspaceRepository.js',
  'src/modules/professional-access/tax-review-collaboration/taxReviewRoutes.js',
  'src/modules/professional-access/tax-review-collaboration/taxReviewController.js',
  'src/modules/professional-access/tax-review-collaboration/taxReviewService.js',
  'src/modules/professional-access/tax-review-collaboration/taxReviewRepository.js',
  'src/modules/professional-access/routes/professionalAccessRoutes.js',
  'src/modules/professional-access/index.js',
  'prisma/fragments/professional-access-foundation.prisma',
  'prisma/fragments/tax-review-collaboration.prisma',
  'prisma/migrations/20260729143000_professional_access_foundation/migration.sql',
  'prisma/migrations/20260729153000_tax_review_collaboration/migration.sql',
  'docs/missions/p1-professional-access-task-work-handoff.md',
  'server.js',
];

for (const file of requiredFiles) {
  expect(fs.existsSync(path.join(root, file)), `Missing required Professional Access file: ${file}`);
}

const contractPath = path.join(root, requiredFiles[0]);
const contractSource = read(requiredFiles[0]);
const contract = require(contractPath);
const authority = read(requiredFiles[1]);
const workspaceRoutes = read(requiredFiles[2]);
const workspaceService = read(requiredFiles[4]);
const taxReviewRoutes = read(requiredFiles[6]);
const taxReviewService = read(requiredFiles[8]);
const aggregateRoutes = read(requiredFiles[10]);
const moduleIndex = read(requiredFiles[11]);
const foundationFragment = read(requiredFiles[12]);
const reviewFragment = read(requiredFiles[13]);
const foundationMigration = read(requiredFiles[14]);
const reviewMigration = read(requiredFiles[15]);
const handoff = read(requiredFiles[16]);
const server = read(requiredFiles[17]);

for (const token of [
  'PROFESSIONAL_ACCESS_BASE_PATH',
  'PROFESSIONAL_ACCESS_RESOURCES',
  'PROFESSIONAL_ACCESS_ACTIONS',
  'PROFESSIONAL_ACCESS_BRANCH_MODES',
  'PROFESSIONAL_ACCESS_ENDPOINTS',
  'PROFESSIONAL_ACCESS_ERROR_CODES',
  'ACCOUNTANT_WORKSPACE_ERROR_CODES',
  'TAX_REVIEW_ERROR_CODES',
  'TAX_REVIEW_SESSION_STATUSES',
]) {
  expect(contractSource.includes(token), `Public contract must export ${token}`);
}

const authoritySuffixes = [
  'USER_REQUIRED',
  'ORGANIZATION_REQUIRED',
  'BUSINESS_REQUIRED',
  'MEMBERSHIP_REQUIRED',
  'MEMBERSHIP_INACTIVE',
  'ASSIGNMENT_REQUIRED',
  'ASSIGNMENT_INACTIVE',
  'ASSIGNMENT_NOT_STARTED',
  'ASSIGNMENT_EXPIRED',
  'PERMISSION_DENIED',
  'BRANCH_INVALID',
];

for (const suffix of authoritySuffixes) {
  expect(
    contract.PROFESSIONAL_ACCESS_ERROR_CODES[suffix] === `PROFESSIONAL_ACCESS_${suffix}`,
    `Shared Professional Access error registry mismatch: ${suffix}`,
  );
  expect(
    contract.ACCOUNTANT_WORKSPACE_ERROR_CODES[suffix] === `ACCOUNTANT_WORKSPACE_${suffix}`,
    `Accountant Workspace error registry mismatch: ${suffix}`,
  );
  expect(
    contract.TAX_REVIEW_ERROR_CODES[suffix] === `TAX_REVIEW_${suffix}`,
    `Tax Review error registry mismatch: ${suffix}`,
  );
}

for (const [key, value] of Object.entries({
  BRANCH_REQUIRED: 'TAX_REVIEW_BRANCH_REQUIRED',
  PERIOD_INVALID: 'TAX_REVIEW_PERIOD_INVALID',
  TITLE_REQUIRED: 'TAX_REVIEW_TITLE_REQUIRED',
  ID_REQUIRED: 'TAX_REVIEW_ID_REQUIRED',
  NOT_FOUND: 'TAX_REVIEW_NOT_FOUND',
  NOTE_REQUIRED: 'TAX_REVIEW_NOTE_REQUIRED',
  ALREADY_RESOLVED: 'TAX_REVIEW_ALREADY_RESOLVED',
})) {
  expect(contract.TAX_REVIEW_ERROR_CODES[key] === value, `Tax Review domain error registry mismatch: ${key}`);
}

expect(
  workspaceService.includes("codePrefix: 'ACCOUNTANT_WORKSPACE'"),
  'Workspace must use ACCOUNTANT_WORKSPACE error-code namespace',
);
expect(
  taxReviewService.includes("codePrefix: 'TAX_REVIEW'"),
  'Tax Review must use TAX_REVIEW error-code namespace',
);

for (const branchMode of [
  'ALL_BUSINESS_BRANCHES',
  'SELECTED_BRANCHES',
  'NO_BRANCH_CONTEXT',
]) {
  expect(contractSource.includes(branchMode), `Missing public branch mode ${branchMode}`);
  expect(authority.includes(branchMode), `Authority must enforce branch mode ${branchMode}`);
}

expect(authority.includes('authorizeProfessionalAccess'), 'Missing shared authorization entry point');
expect(authority.includes('assertPermission'), 'Missing shared permission evaluator');
expect(workspaceService.includes('authorizeProfessionalAccess'), 'Workspace must use shared authority');
expect(taxReviewService.includes('authorizeProfessionalAccess'), 'Tax Review must use shared authority');
expect(taxReviewService.includes('review.branchId'), 'Tax Review mutations must authorize persisted review branch');
expect(workspaceRoutes.includes('router.use(verifyToken)'), 'Workspace routes must remain authenticated');
expect(taxReviewRoutes.includes('router.use(verifyToken)'), 'Tax Review routes must remain authenticated');
expect(aggregateRoutes.includes('accountantWorkspaceRoutes'), 'Aggregate route must include Workspace');
expect(aggregateRoutes.includes('taxReviewRoutes'), 'Aggregate route must include Tax Review');
expect(moduleIndex.includes('professionalAccessContract'), 'Module index must expose public contract');
expect(moduleIndex.includes('professionalAccessAuthority'), 'Module index must expose shared authority');
expect(moduleIndex.includes('PROFESSIONAL_ACCESS_BASE_PATH'), 'Module mount must use contract base path');
expect(server.includes('mountProfessionalAccessModule(app);'), 'Server must mount Professional Access module');

for (const model of [
  'model Business',
  'model BusinessMembership',
  'model ExternalOrganization',
  'model ExternalOrganizationMembership',
  'model BusinessAccountingFirmAssignment',
  'model DelegatedPermissionScope',
]) {
  expect(foundationFragment.includes(model), `Foundation fragment missing ${model}`);
}
expect(reviewFragment.includes('model TaxReviewSession'), 'Tax Review fragment missing TaxReviewSession');
expect(reviewFragment.includes('model TaxReviewNote'), 'Tax Review fragment missing TaxReviewNote');
expect(!foundationMigration.includes('DROP TABLE'), 'Foundation migration must be additive');
expect(!reviewMigration.includes('DROP TABLE'), 'Tax Review migration must be additive');
expect(handoff.includes('prisma validate'), 'Task Work handoff must require Prisma validation');
expect(handoff.includes('Repository, Runtime, and Operational'), 'Task Work handoff must separate verification gates');

console.log('Professional Access Backend Architecture / Repository completion verification: PASS');
