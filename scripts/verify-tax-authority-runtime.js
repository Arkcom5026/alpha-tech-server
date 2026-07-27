/* eslint-env node */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

let failed = false;
const pass = (label) => console.log(`PASS: ${label}`);
const fail = (label) => {
  failed = true;
  console.error(`FAIL: ${label}`);
};
const assertContains = (source, value, label) => {
  if (source.includes(value)) pass(label);
  else fail(`${label} is missing`);
};
const assertNotContains = (source, value, label) => {
  if (source.includes(value)) fail(`${label} is present`);
  else pass(label);
};

const syntaxFiles = [
  'src/modules/tax/index.js',
  'src/modules/tax/http/taxIntakeRoutes.js',
  'src/modules/tax/http/taxIntakeController.js',
  'src/modules/tax/http/taxIntakeService.js',
  'src/modules/tax/intake/registerTaxCandidateService.js',
  'src/modules/tax/sources/sale/registerSaleTaxCandidateService.js',
  'src/modules/tax/documents/lifecycle/taxDocumentLifecycle.js',
  'src/modules/tax/documents/lifecycle/transitionTaxDocumentService.js',
  'src/modules/tax/candidates/repository/taxCandidateRepository.js',
  'src/modules/tax/documents/repository/taxDocumentRepository.js',
];

for (const relativePath of syntaxFiles) {
  try {
    execFileSync(process.execPath, ['--check', path.join(root, relativePath)], { stdio: 'pipe' });
    pass(`syntax ${relativePath}`);
  } catch (error) {
    fail(`syntax ${relativePath}: ${error.stderr?.toString().trim() || error.message}`);
  }
}

// Tax intake and Quick Receipt currently use SQL-migration-owned tables with
// repository $queryRaw access. Their authority is the migration contract, not
// Prisma Client model declarations.
const taxMigration = read('prisma/migrations/20260727233000_add_tax_intake_foundation/migration.sql');
assertContains(taxMigration, 'CREATE TABLE "TaxCandidate"', 'Tax candidate table authority');
assertContains(taxMigration, 'CREATE TABLE "TaxDocument"', 'Tax document table authority');
assertContains(taxMigration, 'CREATE TABLE "TaxDocumentLifecycleEvent"', 'Tax document lifecycle event authority');
assertContains(taxMigration, 'TaxCandidate_branchId_sourceType_sourceId_key', 'Tax candidate source uniqueness');
assertContains(taxMigration, 'TaxDocument_identityKey_key', 'Tax document identity uniqueness');

const quickReceiptMigration = read('prisma/migrations/20260727190000_quick_receipt_session_foundation/migration.sql');
assertContains(quickReceiptMigration, 'CREATE TABLE "QuickReceiptSession"', 'Quick receipt session table authority');
assertContains(quickReceiptMigration, 'CREATE TABLE "QuickReceiptSessionItem"', 'Quick receipt session item table authority');
assertContains(quickReceiptMigration, 'CREATE TABLE "QuickReceiptFinalizeCommand"', 'Quick receipt finalization authority');
assertContains(quickReceiptMigration, 'QuickReceiptSession_active_delivery_unique', 'Quick receipt active delivery uniqueness');

const schema = read('prisma/schema.prisma');
assertContains(schema, 'model PurchaseOrderReceipt {', 'purchase receipt tax source model');

const server = read('server.js');
assertContains(server, "require('./src/modules/tax/http/taxIntakeRoutes')", 'tax intake route import');
assertContains(server, "app.use('/api/tax', taxIntakeRoutes)", 'tax intake route mount');
assertContains(server, "app.use('/api/tax', taxPeriodRoutes)", 'tax period route mount');

const taxIndex = read('src/modules/tax/index.js');
assertContains(taxIndex, 'registerTaxCandidateService', 'tax candidate registration authority');
assertContains(taxIndex, 'registerSaleTaxCandidateService', 'sale tax publication authority');
assertContains(taxIndex, 'transitionTaxDocumentService', 'tax document transition authority');
assertContains(taxIndex, 'taxPeriodRoutes', 'tax period authority');

const routes = read('src/modules/tax/http/taxIntakeRoutes.js');
assertContains(routes, 'router.use(verifyToken)', 'tax intake authentication guard');
assertContains(routes, "'/candidates/register'", 'generic candidate registration endpoint');
assertContains(routes, "'/candidates/register-sale/:saleId'", 'sale candidate registration endpoint');
assertContains(routes, "'/documents/:taxDocumentId/transition'", 'tax document lifecycle endpoint');
assertNotContains(routes, 'controllers/inputTaxReportController', 'legacy input tax controller ownership');

const lifecycle = read('src/modules/tax/documents/lifecycle/taxDocumentLifecycle.js');
assertContains(lifecycle, "DRAFT: Object.freeze(['REGISTERED', 'CANCELLED'])", 'draft lifecycle transitions');
assertContains(lifecycle, "UNDER_REVIEW: Object.freeze(['APPROVED', 'REJECTED', 'CANCELLED'])", 'review lifecycle transitions');
assertContains(lifecycle, 'TAX_DOCUMENT_TRANSITION_FORBIDDEN', 'lifecycle forbidden transition contract');
assertContains(lifecycle, 'replayed: true', 'lifecycle idempotent replay');

const candidateContract = read('src/modules/tax/candidates/contracts/taxCandidateContract.js');
assertContains(candidateContract, 'sourceType', 'tax candidate source identity');
assertContains(candidateContract, 'sourceId', 'tax candidate source reference');
assertContains(candidateContract, 'branchId', 'tax candidate branch authority');

const candidateRepository = read('src/modules/tax/candidates/repository/taxCandidateRepository.js');
assertContains(candidateRepository, 'FROM "TaxCandidate"', 'candidate SQL read authority');
assertContains(candidateRepository, 'INSERT INTO "TaxCandidate"', 'candidate SQL write authority');

const registerCandidate = read('src/modules/tax/intake/registerTaxCandidateService.js');
assertContains(registerCandidate, 'taxCandidateRepository', 'candidate persistence authority');

const saleSource = read('src/modules/tax/sources/sale/registerSaleTaxCandidateService.js');
assertContains(saleSource, 'saleId', 'sale source identity');
assertContains(saleSource, 'registerTaxCandidate', 'sale source delegates to candidate authority');

const packageJson = read('package.json');
assertContains(packageJson, '"test:tax-intake"', 'tax intake test command');
assertContains(packageJson, 'tax-intake-foundation.contract.test.js', 'tax foundation contract coverage');
assertContains(packageJson, 'tax-lifecycle-sale-source.contract.test.js', 'tax lifecycle contract coverage');
assertContains(packageJson, 'tax-step-004-completion.contract.test.js', 'tax completion contract coverage');

if (failed) {
  console.error('\nTAX AUTHORITY VERIFICATION: FAIL');
  process.exit(1);
}

console.log('\nTAX AUTHORITY VERIFICATION: PASS');
