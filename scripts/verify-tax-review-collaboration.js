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
  'prisma/fragments/tax-review-collaboration.prisma',
  'prisma/migrations/20260729153000_tax_review_collaboration/migration.sql',
];

for (const file of files) {
  expect(fs.existsSync(path.join(root, file)), `Missing ${file}`);
}

const repository = read(files[0]);
const service = read(files[1]);
const routes = read(files[3]);
const fragment = read(files[5]);
const migration = read(files[6]);

for (const code of [
  'TAX_REVIEW_MEMBERSHIP_REQUIRED',
  'TAX_REVIEW_ASSIGNMENT_REQUIRED',
  'TAX_REVIEW_PERMISSION_DENIED',
  'TAX_REVIEW_NOT_FOUND',
  'TAX_REVIEW_ALREADY_RESOLVED',
]) {
  expect(service.includes(code), `Missing fail-closed code ${code}`);
}

for (const action of ['READ', 'COMMENT', 'RESOLVE']) {
  expect(service.includes(`action: '${action}'`), `Missing permission action ${action}`);
}

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
