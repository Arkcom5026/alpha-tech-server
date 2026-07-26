const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function requireTokens(relativePath, tokens) {
  const content = read(relativePath);
  for (const token of tokens) {
    assert.ok(content.includes(token), `${relativePath} missing completion token: ${token}`);
  }
  return content;
}

function requireOrderedTokens(relativePath, tokens) {
  const content = read(relativePath);
  let cursor = -1;
  for (const token of tokens) {
    const index = content.indexOf(token, cursor + 1);
    assert.ok(index > cursor, `${relativePath} missing or misordered E2E token: ${token}`);
    cursor = index;
  }
}

function run() {
  const requiredFiles = [
    'src/modules/repair/controllers/repairController.js',
    'src/modules/repair/routes/repairRoutes.js',
    'src/modules/repair/middlewares/repairAuthorization.js',
    'src/modules/repair/repositories/repairRepository.js',
    'src/modules/repair/services/repairIntakeService.js',
    'src/modules/repair/services/repairDiagnosisService.js',
    'src/modules/repair/services/repairEstimateService.js',
    'src/modules/repair/services/repairPartUsageSummaryService.js',
    'src/modules/repair/services/repairCompletionService.js',
    'src/modules/repair/services/repairSettlementService.js',
    'src/modules/repair/services/repairHandoverService.js',
    'src/modules/repair/services/repairWarrantyService.js',
    'src/modules/repair/services/warrantyClaimService.js',
    'src/modules/repair/services/repairExecutiveSummaryService.js',
    'scripts/verify-repair-repository-gate.js',
  ];

  for (const file of requiredFiles) {
    assert.ok(exists(file), `required Repair E2E file missing: ${file}`);
  }

  requireTokens('server.js', [
    "const repairRoutes = require('./src/modules/repair/routes/repairRoutes')",
    "app.use('/api/repairs', repairRoutes)",
    "app.use('/api/repair', repairRoutes)",
  ]);

  requireTokens('src/modules/repair/routes/repairRoutes.js', [
    "router.use(verifyToken)",
    'router.use(loadRepairEmployeeContext)',
    "const READ_AND_INTAKE_ROLES = ['OWNER', 'MANAGER', 'CASHIER']",
    "const OPERATION_ROLES = ['OWNER', 'MANAGER']",
    "router.get('/intake-context/:lookup'",
    "router.post('/jobs'",
    "router.get('/jobs/:id/diagnoses'",
    "router.post('/jobs/:id/diagnoses'",
    "router.post('/jobs/:id/estimates'",
    "router.patch('/jobs/:id/estimates/:estimateId/decision'",
    "router.post('/jobs/:id/parts'",
    "router.post('/jobs/:id/parts/:partItemId/reversal'",
    "router.put('/jobs/:id/completion-checklist'",
    "router.patch('/jobs/:id/status'",
    "router.post('/jobs/:id/payments'",
    "router.post('/jobs/:id/invoices'",
    "router.post('/jobs/:id/handover'",
    "router.post('/jobs/:id/repair-warranties'",
    "router.post('/jobs/:id/warranty-claims'",
    "router.patch('/warranty-claims/:claimId/status'",
    "router.get('/dashboard/executive-summary'",
  ]);

  requireOrderedTokens('src/modules/repair/routes/repairRoutes.js', [
    "router.use(verifyToken)",
    'router.use(loadRepairEmployeeContext)',
    "router.get('/intake-context/:lookup'",
    "router.post('/jobs'",
    "router.post('/jobs/:id/diagnoses'",
    "router.post('/jobs/:id/estimates'",
    "router.post('/jobs/:id/payments'",
    "router.post('/jobs/:id/handover'",
    "router.post('/jobs/:id/warranty-claims'",
  ]);

  requireTokens('src/modules/repair/controllers/repairController.js', [
    'getIntakeContext',
    'createJob',
    'recordDiagnosis',
    'createEstimate',
    'decideEstimate',
    'addParts',
    'reversePartUsage',
    'recordCompletionChecklist',
    'updateStatus',
    'recordPayment',
    'issueInvoice',
    'handoverToCustomer',
    'issueRepairWarranty',
    'openWarrantyClaim',
    'updateWarrantyClaimStatus',
    'getExecutiveSummary',
  ]);

  requireTokens('src/modules/repair/middlewares/repairAuthorization.js', [
    'loadRepairEmployeeContext',
    'allowRepairRoles',
    'branchId',
    'role',
  ]);

  const packageJson = JSON.parse(read('package.json'));
  const scripts = packageJson.scripts || {};
  assert.ok(scripts['verify:repair-repository-gate'], 'package.json missing verify:repair-repository-gate');
  assert.ok(scripts['verify:repair-e2e-completion-audit'], 'package.json missing verify:repair-e2e-completion-audit');
  assert.ok(scripts['verify:repair-complete'], 'package.json missing verify:repair-complete');
  assert.ok(
    scripts['verify:repair-complete'].includes('npm run verify:repair-e2e-completion-audit'),
    'verify:repair-complete must include final Repair E2E completion audit',
  );

  console.log('Repair E2E completion audit: PASS');
}

run();
