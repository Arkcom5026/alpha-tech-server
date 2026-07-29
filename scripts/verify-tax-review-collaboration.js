'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

const files = [
  'src/modules/professional-access/tax-review-collaboration/taxReviewRepository.js',
  'src/modules/professional-access/tax-review-collaboration/taxReviewService.js',
  'src/modules/professional-access/tax-review-collaboration/taxReviewController.js',
  'src/modules/professional-access/tax-review-collaboration/taxReviewRoutes.js',
  'src/modules/professional-access/tax-review-collaboration/index.js',
  'src/modules/professional-access/shared/professionalAccessAuthority.js',
  'src/modules/professional-access/contracts/professionalAccess.contract.js',
  'prisma/fragments/tax-review-collaboration.prisma',
  'prisma/migrations/20260729153000_tax_review_collaboration/migration.sql',
];

for (const file of files) {
  expect(fs.existsSync(path.join(root, file)), `Missing ${file}`);
}

const repository = read(files[0]);
const service = read(files[1]);
const routes = read(files[3]);
const authority = read(files[5]);
const contract = require(path.join(root, files[6]));
const fragment = read(files[7]);
const migration = read(files[8]);

expect(
  service.includes("codePrefix: 'TAX_REVIEW'"),
  'Tax Review service must use TAX_REVIEW authority prefix',
);

const requiredCodes = {
  USER_REQUIRED: 'TAX_REVIEW_USER_REQUIRED',
  ORGANIZATION_REQUIRED: 'TAX_REVIEW_ORGANIZATION_REQUIRED',
  BUSINESS_REQUIRED: 'TAX_REVIEW_BUSINESS_REQUIRED',
  MEMBERSHIP_REQUIRED: 'TAX_REVIEW_MEMBERSHIP_REQUIRED',
  MEMBERSHIP_INACTIVE: 'TAX_REVIEW_MEMBERSHIP_INACTIVE',
  ASSIGNMENT_REQUIRED: 'TAX_REVIEW_ASSIGNMENT_REQUIRED',
  ASSIGNMENT_INACTIVE: 'TAX_REVIEW_ASSIGNMENT_INACTIVE',
  ASSIGNMENT_NOT_STARTED: 'TAX_REVIEW_ASSIGNMENT_NOT_STARTED',
  ASSIGNMENT_EXPIRED: 'TAX_REVIEW_ASSIGNMENT_EXPIRED',
  PERMISSION_DENIED: 'TAX_REVIEW_PERMISSION_DENIED',
  BRANCH_INVALID: 'TAX_REVIEW_BRANCH_INVALID',
  NOT_FOUND: 'TAX_REVIEW_NOT_FOUND',
  ALREADY_RESOLVED: 'TAX_REVIEW_ALREADY_RESOLVED',
};

for (const [key, code] of Object.entries(requiredCodes)) {
  expect(
    contract.TAX_REVIEW_ERROR_CODES?.[key] === code,
    `Missing public Tax Review error code ${code}`,
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

for (const action of ['READ', 'COMMENT', 'RESOLVE']) {
  expect(service.includes(`action: '${action}'`), `Missing permission action ${action}`);
}

expect(
  service.includes('branchId: review.branchId'),
  'Tax Review note/resolve authority must use persisted review.branchId',
);
expect(
  service.includes("fail('TAX_REVIEW_ALREADY_RESOLVED'"),
  'Resolved Tax Review must reject new notes',
);
expect(
  service.includes('return { replayed: true, review: authority.review };'),
  'Repeated Tax Review resolve must remain idempotent',
);
expect(repository.includes("resource: 'TAX_REVIEW'"), 'Repository must require TAX_REVIEW scope');
expect(repository.includes("status: 'ACTIVE'"), 'Repository must require active authority');
expect(routes.includes('router.use(verifyToken)'), 'Routes must require authentication');
expect(routes.includes('controller.listReviews'), 'Missing list route');
expect(routes.includes('controller.createReview'), 'Missing create route');
expect(routes.includes('controller.addNote'), 'Missing note route');
expect(routes.includes('controller.resolveReview'), 'Missing resolve route');
expect(fragment.includes('model TaxReviewSession'), 'Missing TaxReviewSession model');
expect(fragment.includes('model TaxReviewNote'), 'Missing TaxReviewNote model');
expect(migration.includes('CREATE TABLE "TaxReviewSession"'), 'Missing review migration');
expect(migration.includes('CREATE TABLE "TaxReviewNote"'), 'Missing note migration');
expect(!migration.includes('DROP TABLE'), 'Migration must be additive');

console.log('Tax Review Collaboration repository verification: PASS');
