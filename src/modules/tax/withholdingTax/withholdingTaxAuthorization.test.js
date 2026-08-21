'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
const READ = POSITION_CAPABILITIES.TAX_WITHHOLDING_READ;
const TREATMENT = POSITION_CAPABILITIES.TAX_WITHHOLDING_TREATMENT;
const CERTIFICATE_ISSUE = POSITION_CAPABILITIES.TAX_WITHHOLDING_CERTIFICATE_ISSUE;
const FILING_PREPARE = POSITION_CAPABILITIES.TAX_WITHHOLDING_FILING_PREPARE;
const FILING_SUBMIT = POSITION_CAPABILITIES.TAX_WITHHOLDING_FILING_SUBMIT;
const ALL = [READ, TREATMENT, CERTIFICATE_ISSUE, FILING_PREPARE, FILING_SUBMIT];

test('legacy withholding tax authority preserves OWNER and MANAGER only', () => {
  for (const employeeRole of ['OWNER', 'MANAGER']) {
    for (const capability of ALL) assert.equal(hasCapability({ employeeRole }, capability), true);
  }
  for (const employeeRole of ['CASHIER', 'TECHNICIAN']) {
    for (const capability of ALL) assert.equal(hasCapability({ employeeRole }, capability), false);
  }
});

test('migrated positions keep withholding tax authority explicitly separated', () => {
  assert.equal(hasCapability({ employeeRole: 'OWNER', positionCapabilities: [READ] }, READ), true);
  assert.equal(hasCapability({ employeeRole: 'OWNER', positionCapabilities: [READ] }, TREATMENT), false);
  assert.equal(hasCapability({ employeeRole: 'OWNER', positionCapabilities: [READ, TREATMENT] }, TREATMENT), true);
  assert.equal(hasCapability({ employeeRole: 'OWNER', positionCapabilities: [READ, CERTIFICATE_ISSUE] }, CERTIFICATE_ISSUE), true);
  assert.equal(hasCapability({ employeeRole: 'OWNER', positionCapabilities: [READ, FILING_PREPARE] }, FILING_SUBMIT), false);
  assert.equal(hasCapability({ employeeRole: 'OWNER', positionCapabilities: [] }, READ), false);
});

test('platform admin retains all withholding tax authority', () => {
  for (const role of ['ADMIN', 'SUPERADMIN']) {
    for (const capability of ALL) assert.equal(hasCapability({ role, positionCapabilities: [] }, capability), true);
  }
});

test('withholding tax routes split read, assessment, certificate and filing authority while controller retains branch isolation', () => {
  const routes = read('src/modules/tax/periods/taxPeriodRoutes.js');
  const controller = read('src/modules/tax/withholdingTax/withholdingTaxController.js');

  assert.match(routes, /allowWithholdingTaxCapabilities\(\s*TAX_WITHHOLDING_CAPABILITY\.READ,?\s*\)/);
  assert.match(routes, /allowWithholdingTaxCapabilities\(\s*TAX_WITHHOLDING_CAPABILITY\.READ,\s*TAX_WITHHOLDING_CAPABILITY\.TREATMENT,?\s*\)/);
  assert.match(routes, /allowWithholdingTaxCapabilities\(\s*TAX_WITHHOLDING_CAPABILITY\.READ,\s*TAX_WITHHOLDING_CAPABILITY\.CERTIFICATE_ISSUE,?\s*\)/);
  assert.match(routes, /allowWithholdingTaxCapabilities\(\s*TAX_WITHHOLDING_CAPABILITY\.READ,\s*TAX_WITHHOLDING_CAPABILITY\.FILING_PREPARE,?\s*\)/);
  assert.match(routes, /allowWithholdingTaxCapabilities\(\s*TAX_WITHHOLDING_CAPABILITY\.READ,\s*TAX_WITHHOLDING_CAPABILITY\.FILING_PREPARE,\s*TAX_WITHHOLDING_CAPABILITY\.FILING_SUBMIT,?\s*\)/);
  assert.match(routes, /router\.get\('\/withholding-tax\/:taxPeriodId', allowWithholdingRead, withholdingTaxController\.getWorkspace\)/);
  assert.match(routes, /router\.post\('\/withholding-tax\/items\/:taxExpenseItemId\/treatment', allowWithholdingTreatment, withholdingTaxController\.transitionTreatment\)/);
  assert.match(routes, /router\.post\('\/withholding-tax\/:taxPeriodId\/certificates\/issue', allowWithholdingCertificateIssue, withholdingTaxController\.issueCertificate\)/);
  assert.match(routes, /router\.post\('\/withholding-tax\/:taxPeriodId\/filings\/:formType\/prepare', allowWithholdingFilingPrepare, withholdingTaxController\.prepareFiling\)/);
  assert.match(routes, /router\.post\('\/withholding-tax\/:taxPeriodId\/filings\/:formType\/submit', allowWithholdingFilingSubmit, withholdingTaxController\.submitFiling\)/);
  assert.doesNotMatch(controller, /OWNER.*MANAGER|MANAGER.*OWNER/);
  assert.doesNotMatch(controller, /WHT_ACCESS_FORBIDDEN/);
  assert.match(controller, /WHT_BRANCH_FORBIDDEN/);
  assert.match(controller, /WHT_PERIOD_IMMUTABLE/);
});
