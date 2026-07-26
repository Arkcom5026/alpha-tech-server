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
    'src/modules/repair/services/repairCostAnalyticsService.js',
    'src/modules/repair/services/repairRepeatFailureAnalyticsService.js',
    'src/modules/repair/controllers/repairController.js',
    'src/modules/repair/routes/repairRoutes.js',
    'scripts/verify-repair-operational-intelligence.js',
    'scripts/verify-repair-dashboard-contract.js',
    'scripts/verify-repair-operational-risk.js',
    'scripts/verify-repair-operational-decision.js',
    'scripts/verify-repair-management-snapshot.js',
  ];

  for (const file of requiredFiles) {
    assert.ok(exists(file), `required repair milestone file missing: ${file}`);
  }

  requireSource('src/modules/repair/routes/repairRoutes.js', [
    "router.get('/dashboard'",
    "router.get('/dashboard/risks'",
    "router.get('/dashboard/decisions'",
    '/jobs/:id/operational-intelligence',
    '/jobs/:id/cost-analytics',
    '/jobs/:id/repeat-failure-analytics',
  ]);

  requireSource('src/modules/repair/controllers/repairController.js', [
    'getOperationalDashboard',
    'getOperationalRiskDashboard',
    'getOperationalDecisionDashboard',
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

  requireSource('scripts/verify-repair-management-snapshot.js', [
    'buildDashboardProjection',
    'buildOperationalRiskProjection',
    'buildOperationalDecisionProjection',
    'Repair management snapshot verifier: PASS',
  ]);

  const packageJson = JSON.parse(read('package.json'));
  const scripts = packageJson.scripts || {};
  const requiredScripts = [
    'verify:repair-operational-intelligence',
    'verify:repair-dashboard',
    'verify:repair-operational-risk',
    'verify:repair-operational-decision',
    'verify:repair-management-snapshot',
    'verify:repair-repository-gate',
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
    'verify:repair-repository-gate',
  ]) {
    assert.ok(scripts['verify:repair-complete'].includes(`npm run ${child}`), `verify:repair-complete missing ${child}`);
  }

  console.log('Repair repository gate verifier: PASS');
}

run();
