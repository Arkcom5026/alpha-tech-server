'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const contract = require('../src/modules/tax/contracts/inputTaxFrontendContract');
const server = read('server.js');
const intakeRoutes = read('src/modules/tax/http/taxIntakeRoutes.js');
const periodRoutes = read('src/modules/tax/periods/taxPeriodRoutes.js');
const reportRoutes = read('src/modules/reporting/tax/input/routes/inputTaxReportRoutes.js');

assert.equal(contract.CONTRACT_VERSION, 1);
assert.equal(contract.TAX_INTAKE_BASE, '/api/tax-intake');
assert.equal(contract.TAX_PERIOD_BASE, '/api/tax-periods');
assert.equal(contract.INPUT_TAX_REPORT_BASE, '/api/input-tax-reports');

assert.match(server, /app\.use\('\/api\/tax-intake', taxIntakeRoutes\)/);
assert.match(server, /app\.use\('\/api\/tax-periods', taxPeriodRoutes\)/);
assert.match(server, /app\.use\('\/api\/input-tax-reports', inputTaxReportRoutes\)/);
assert.match(server, /app\.use\('\/api\/tax', taxIntakeRoutes\)/);
assert.match(server, /app\.use\('\/api\/tax', taxPeriodRoutes\)/);

assert.match(intakeRoutes, /input-documents\/overview/);
assert.match(intakeRoutes, /input-documents\/pending/);
assert.match(intakeRoutes, /input-documents\/filing/);
assert.match(intakeRoutes, /inputTaxDecisionRoutes/);
assert.match(intakeRoutes, /receipt-links/);
assert.match(periodRoutes, /accounting-office\/packages/);
assert.match(periodRoutes, /periods\/:taxPeriodId\/reopen/);
assert.match(reportRoutes, /router\.get\('\/', getInputTaxReport\)/);

const byId = new Map(contract.endpoints.map((item) => [item.id, item]));
[
  'input-tax-overview',
  'tax-document-detail',
  'tax-document-transition',
  'receipt-link-attach',
  'duplicate-decision',
  'replacement-link',
  'filing-select',
  'filing-remove',
  'filing-submit',
  'tax-period-transition',
  'accounting-office-package',
  'input-vat-report',
].forEach((id) => assert.ok(byId.has(id), `missing frontend contract endpoint: ${id}`));

assert.equal(byId.get('filing-remove').concurrency.versionField, 'version|expectedVersion');
assert.equal(byId.get('input-vat-report').bounds.maxRows, 2000);
assert.equal(byId.get('input-tax-overview').bounds.maxExplicitRangeDays, 366);
assert.equal(byId.get('tax-period-transition').replay, 'MUTATION_REPLAY_SAFE');
assert.ok(contract.unavailableSurfaces.some((item) => item.id === 'investigation-workspace'));
assert.ok(contract.compatibilityAliases.every((item) => item.aliasBase === '/api/tax'));

console.log('input tax step 10a frontend contract evidence: PASS');
