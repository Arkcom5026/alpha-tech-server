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

const schema = read('prisma/schema.prisma');
assertContains(schema, 'model TaxCandidate {', 'Tax candidate model');
assertContains(schema, 'model TaxDocument {', 'Tax document model');
assertContains(schema, 'model TaxDocumentLine {', 'Tax document line model');
assertContains(schema, 'model QuickReceiptSession {', 'Quick receipt session model');
assertContains(schema, 'model QuickReceiptSessionItem {', 'Quick receipt session item model');
assertContains(schema, 'model PurchaseOrderReceipt {', 'purchase receipt tax source model');

const server = read('server.js');
assertContains(server, "require('./src/modules/tax/http/taxIntakeRoutes')", 'tax intake route import');
assertContains(server, "app.use('/api/tax/intake', taxIntakeRoutes)", 'tax intake route mount');

const taxIndex = read('src/modules/tax/index.js');
assertContains(taxIndex, "registerTaxCandidateService", 'tax candidate registration authority');
assertContains(taxIndex, "registerSaleTaxCandidateService", 'sale tax publication authority');
assertContains(taxIndex, "transitionTaxDocumentService", 'tax document transition authority');
assertContains(taxIndex, "taxPeriodRoutes", 'tax period authority');

const routes = read('src/modules/tax/http/taxIntakeRoutes.js');
assertContains(routes, 'router.use(verifyToken)', 'tax intake authentication guard');
assertContains(routes, "'/candidates/register'", 'generic candidate registration endpoint');
assertContains(routes, "'/candidates/register-sale/:saleId'", 'sale candidate registration endpoint');
assertContains(routes, "'/documents/:taxDocumentId/transition'", 'tax document lifecycle endpoint');
assertNotContains(routes, "controllers/inputTaxReportController", 'legacy input tax controller ownership');

const lifecycle = read('src/modules/tax/documents/lifecycle/taxDocumentLifecycle.js');
assertContains(lifecycle, "DRAFT: Object.freeze(['REGISTERED', 'CANCELLED'])", 'draft lifecycle transitions');
assertContains(lifecycle, "UNDER_REVIEW: Object.freeze(['APPROVED', 'REJECTED', 'CANCELLED'])", 'review lifecycle transitions');
assertContains(lifecycle, 'TAX_DOCUMENT_TRANSITION_FORBIDDEN', 'lifecycle forbidden transition contract');
assertContains(lifecycle, 'replayed: true', 'lifecycle idempotent replay');

const candidateContract = read('src/modules/tax/candidates/contracts/taxCandidateContract.js');
assertContains(candidateContract, 'sourceType', 'tax candidate source identity');
assertContains(candidateContract, 'sourceId', 'tax candidate source reference');
assertContains(candidateContract, 'branchId', 'tax candidate branch authority');

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
