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

function requireSource(relativePath, tokens) {
  const content = read(relativePath);
  for (const token of tokens) {
    assert.ok(content.includes(token), `${relativePath} missing contract token: ${token}`);
  }
}

function run() {
  const requiredFiles = [
    'src/modules/repair/services/repairOperationalIntelligenceService.js',
    'src/modules/repair/services/repairOperationalRiskService.js',
    'src/modules/repair/services/repairOperationalDecisionService.js',
    'src/modules/repair/services/repairManagementAlertService.js',
    'src/modules/repair/services/repairManagementBriefService.js',
    'src/modules/repair/services/repairExecutiveSummaryService.js',
    'src/modules/repair/services/repairCostAnalyticsService.js',
    'src/modules/repair/services/repairRepeatFailureAnalyticsService.js',
    'src/modules/repair/controllers/repairController.js',
    'src/modules/repair/routes/repairRoutes.js',
    'scripts/verify-repair-operational-intelligence.js',
    'scripts/verify-repair-dashboard-contract.js',
    'scripts/verify-repair-operational-risk.js',
    'scripts/verify-repair-operational-decision.js',
    'scripts/verify-repair-management-snapshot.js',
    'scripts/verify-repair-management-alert.js',
    'scripts/verify-repair-management-brief.js',
    'scripts/verify-repair-executive-summary.js',
    'scripts/verify-repair-contract-boundary-audit.js',
    'scripts/verify-repair-module-isolation.js',
    'scripts/verify-repair-api-contract-integrity.js',
    'scripts/verify-repair-workflow-integrity.js',
    'scripts/verify-repair-e2e-completion-audit.js',
  ];

  for (const file of requiredFiles) {
    assert.ok(exists(file), `required repair milestone file missing: ${file}`);
  }

  requireSource('src/modules/repair/routes/repairRoutes.js', [
    "router.get('/dashboard'",
    "router.get('/dashboard/risks'",
    "router.get('/dashboard/decisions'",
    "router.get('/dashboard/alerts'",
    "router.get('/dashboard/brief'",
    "router.get('/dashboard/executive-summary'",
    '/jobs/:id/operational-intelligence',
    '/jobs/:id/cost-analytics',
    '/jobs/:id/repeat-failure-analytics',
    "if (req.method === 'GET')",
    "res.setHeader('Cache-Control', 'no-store')",
  ]);

  requireSource('src/modules/repair/controllers/repairController.js', [
    'getOperationalDashboard',
    'getOperationalRiskDashboard',
    'getOperationalDecisionDashboard',
    'getManagementAlertDashboard',
    'getManagementDailyBrief',
    'getExecutiveSummary',
    'getOperationalIntelligence',
    'getCostAnalytics',
    'getRepeatFailureAnalytics',
  ]);

  requireSource('src/modules/repair/services/repairOperationalRiskService.js', [
    'OPERATIONAL_RISK_CONTRACT_VERSION',
    'buildHealthProjection',
    'buildActionQueue',
    'breakdown',
    'actionQueue',
  ]);

  requireSource('src/modules/repair/services/repairOperationalDecisionService.js', [
    'DECISION_CONTRACT_VERSION',
    'buildOperationalDecision',
    'buildManagerSummary',
    'managerSummary',
    'priorityQueue',
  ]);

  requireSource('src/modules/repair/services/repairManagementAlertService.js', [
    'MANAGEMENT_ALERT_CONTRACT_VERSION',
    'buildManagementAlerts',
    'buildEscalationQueue',
    'escalationQueue',
    'topActions',
  ]);

  requireSource('src/modules/repair/services/repairManagementBriefService.js', [
    'MANAGEMENT_BRIEF_CONTRACT_VERSION',
    'buildManagementKpiSnapshot',
    'assignmentCoverageRate',
    'escalationRate',
    'buildTrendProjection',
    'IMPROVING',
    'STABLE',
    'WORSENING',
    'kpis',
    'trend',
  ]);

  requireSource('src/modules/repair/services/repairExecutiveSummaryService.js', [
    'EXECUTIVE_SUMMARY_CONTRACT_VERSION',
    'repair-executive-summary.v1',
    'buildHealthScore',
    'buildHealthBand',
    'buildHealthDimensions',
    'buildPriorityFocus',
    'HEALTHY',
    'WATCH',
    'CRITICAL',
    'priorityFocus',
    'healthScore',
  ]);

  requireSource('scripts/verify-repair-management-snapshot.js', [
    'buildDashboardProjection',
    'buildOperationalRiskProjection',
    'buildOperationalDecisionProjection',
    'Repair management snapshot verifier: PASS',
  ]);

  requireSource('scripts/verify-repair-management-alert.js', [
    'buildManagementAlertProjection',
    'NO_IMMEDIATE_MANAGEMENT_ACTION',
    'Repair management alert verifier: PASS',
  ]);

  requireSource('scripts/verify-repair-management-brief.js', [
    'buildManagementKpiSnapshot',
    'buildTrendProjection',
    'assignmentCoverageRate',
    'escalationRate',
    'WORSENING',
    'IMPROVING',
    'STABLE',
    'Repair management brief verifier: PASS',
  ]);

  requireSource('scripts/verify-repair-executive-summary.js', [
    'buildHealthScore',
    'buildExecutiveSummaryProjection',
    'MAINTAIN_OPERATIONAL_HEALTH',
    'RESOLVE_CRITICAL_JOBS',
    'Repair executive summary verifier: PASS',
  ]);

  requireSource('scripts/verify-repair-contract-boundary-audit.js', [
    'assertNotContains',
    "require('../repositories/",
    'mutationLines',
    'RepairFailureCode.EMPLOYEE_CONTEXT_REQUIRED',
    'Repair contract and boundary audit: PASS',
  ]);

  requireSource('scripts/verify-repair-module-isolation.js', [
    'extractRequires',
    'allowedDirectPrismaOwners',
    'imports another feature module directly',
    'owned data-boundary relation',
    'Repair module isolation verifier: PASS',
  ]);

  requireSource('scripts/verify-repair-api-contract-integrity.js', [
    'extractMethod',
    'data.idempotent ? 200 : 201',
    "if (req.method === 'GET')",
    'class RepairError extends AppError',
    'Repair API contract integrity audit: PASS',
  ]);

  requireSource('scripts/verify-repair-workflow-integrity.js', [
    'assertRepairTransition(job.status, payload.status)',
    'assertRepairExecutionAuthorized({',
    'assertRepairCanComplete(job)',
    'RepairFailureCode.ACTIVE_CLAIM_BLOCKS_HANDOVER',
    'assertClaimTransition(claim.status, payload.status)',
    'Repair workflow integrity audit: PASS',
  ]);

  requireSource('scripts/verify-repair-e2e-completion-audit.js', [
    "app.use('/api/repairs', repairRoutes)",
    "app.use('/api/repair', repairRoutes)",
    'requireOrderedTokens',
    'loadRepairEmployeeContext',
    'allowRepairRoles',
    'Repair E2E completion audit: PASS',
  ]);

  const packageJson = JSON.parse(read('package.json'));
  const scripts = packageJson.scripts || {};
  const requiredScripts = [
    'verify:repair-operational-intelligence',
    'verify:repair-dashboard',
    'verify:repair-operational-risk',
    'verify:repair-operational-decision',
    'verify:repair-management-snapshot',
    'verify:repair-management-alert',
    'verify:repair-management-brief',
    'verify:repair-executive-summary',
    'verify:repair-contract-boundary-audit',
    'verify:repair-module-isolation',
    'verify:repair-api-contract-integrity',
    'verify:repair-workflow-integrity',
    'verify:repair-repository-gate',
    'verify:repair-e2e-completion-audit',
    'verify:repair-complete',
  ];
  for (const script of requiredScripts) {
    assert.ok(scripts[script], `package.json missing script: ${script}`);
  }

  for (const child of [
    'verify:repair-operational-intelligence',
    'verify:repair-dashboard',
    'verify:repair-operational-risk',
    'verify:repair-operational-decision',
    'verify:repair-management-snapshot',
    'verify:repair-management-alert',
    'verify:repair-management-brief',
    'verify:repair-executive-summary',
    'verify:repair-contract-boundary-audit',
    'verify:repair-module-isolation',
    'verify:repair-api-contract-integrity',
    'verify:repair-workflow-integrity',
    'verify:repair-repository-gate',
    'verify:repair-e2e-completion-audit',
  ]) {
    assert.ok(scripts['verify:repair-complete'].includes(`npm run ${child}`), `verify:repair-complete missing ${child}`);
  }

  console.log('Repair repository gate verifier: PASS');
}

run();
