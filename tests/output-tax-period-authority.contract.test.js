'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const periodService = read(
  'src/modules/tax/outputTax/period/application/outputTaxPeriodService.js',
);
const periodGuard = read('src/modules/tax/outputTax/period/guard/outputTaxPeriodGuard.js');
const periodRepository = read(
  'src/modules/tax/outputTax/period/repository/outputTaxPeriodRepository.js',
);
const closingPlan = read(
  'src/modules/tax/outputTax/closing/buildOutputTaxPeriodClosingPlanService.js',
);
const periodReport = read(
  'src/modules/tax/outputTax/reporting/buildOutputTaxPeriodReportService.js',
);
const periodReadiness = read(
  'src/modules/tax/outputTax/readiness/buildOutputTaxPeriodReadinessService.js',
);
const outputTaxOverview = read(
  'src/modules/tax/outputTax/dashboard/buildOutputTaxOverviewService.js',
);
const intakeRoutes = read('src/modules/tax/http/taxIntakeRoutes.js');
const registerCandidate = read('src/modules/tax/intake/registerTaxCandidateService.js');
const convertCandidate = read(
  'src/modules/tax/candidates/conversion/convertTaxCandidateService.js',
);
const issueDocument = read('src/modules/tax/documents/issue/issueTaxDocumentService.js');
const cancelDocument = read(
  'src/modules/tax/documents/cancellation/cancelTaxDocumentService.js',
);
const replaceDocument = read(
  'src/modules/tax/documents/replacement/replaceCancelledTaxDocumentService.js',
);
const transitionDocument = read(
  'src/modules/tax/documents/lifecycle/transitionTaxDocumentService.js',
);

const expectIncludes = (source, fragments, subject) => {
  for (const fragment of fragments) {
    assert.ok(
      source.includes(fragment),
      `${subject} must include ${JSON.stringify(fragment)}`,
    );
  }
};

expectIncludes(
  periodService,
  [
    "OPEN: 'OPEN'",
    "CLOSING: 'CLOSING'",
    "CLOSED: 'CLOSED'",
    "REOPENED: 'REOPENED'",
    'targetStatus: PERIOD_STATUS.CLOSING',
    'targetStatus: PERIOD_STATUS.CLOSED',
    'targetStatus: PERIOD_STATUS.REOPENED',
    'OUTPUT_TAX_PERIOD_READINESS_BLOCKED',
    'OUTPUT_TAX_PERIOD_CLOSE_SNAPSHOT_V1',
    'findByIdForUpdate',
    'expectedVersion',
    'appendEvent',
  ],
  'OutputTaxPeriod application service',
);

expectIncludes(
  periodRepository,
  [
    'findByIdForUpdate',
    'FOR UPDATE',
    'findByBranchYearMonth',
    'transitionStatus',
    'updateSnapshot',
    'appendEvent',
    'listEvents',
  ],
  'OutputTaxPeriod repository',
);

expectIncludes(
  periodGuard,
  [
    'OUTPUT_TAX_PERIOD_LOCKED',
    "status === 'CLOSING'",
    "status === 'CLOSED'",
    'assertPeriodAllowsCreate',
    'assertPeriodAllowsIssue',
    'assertPeriodAllowsCancel',
    'assertPeriodAllowsReplace',
    'assertPeriodAllowsTransition',
  ],
  'OutputTaxPeriod runtime guard',
);

expectIncludes(
  closingPlan,
  [
    'OUTPUT_TAX_PERIOD_CLOSING_PLAN_V2',
    'findByBranchYearMonth',
    'persistentCloseSupported: true',
    'closeAuthorityImplemented: true',
    "? 'CREATE_PERIOD'",
    "? 'REQUEST_CLOSE'",
    "? 'CLOSE_PERIOD'",
    "? 'REOPEN_PERIOD'",
    "['CLOSING', 'CLOSED'].includes(period.status)",
    "? 'CREATE_OUTPUT_TAX_PERIOD'",
    "? 'REQUEST_OUTPUT_TAX_PERIOD_CLOSE'",
    "? 'CLOSE_OUTPUT_TAX_PERIOD'",
    "? 'OUTPUT_TAX_PERIOD_CLOSED'",
  ],
  'OutputTaxPeriod closing plan projection',
);

expectIncludes(
  periodReport,
  [
    'OUTPUT_TAX_PERIOD_REPORT_V2',
    'findByBranchYearMonth',
    'periodExists',
    'lockedForTaxWrites',
    'closeRequestedAt',
    'closedAt',
    'reopenedAt',
  ],
  'OutputTaxPeriod monthly report projection',
);

expectIncludes(
  periodReadiness,
  [
    'OUTPUT_TAX_PERIOD_READINESS_V2',
    'compatibilitySchemaVersion',
    'readyForCloseAuthorization',
    'closeRequestAllowed',
    'closeAllowed',
    'reopenAllowed',
    'nextRequiredAction',
  ],
  'OutputTaxPeriod readiness projection',
);

expectIncludes(
  outputTaxOverview,
  [
    'OUTPUT_TAX_OVERVIEW_V2',
    'compatibilitySchemaVersion',
    'periodExists',
    'lockedForTaxWrites',
    'closeRequestedAt',
    'closedAt',
    'reopenedAt',
  ],
  'Output tax overview projection',
);

expectIncludes(
  intakeRoutes,
  [
    "'/output-tax/periods'",
    "'/output-tax/periods/:id'",
    "'/output-tax/periods/:id/timeline'",
    "'/output-tax/periods/:id/request-close'",
    "'/output-tax/periods/:id/close'",
    "'/output-tax/periods/:id/reopen'",
  ],
  'Tax intake HTTP routes',
);

const guardedServices = [
  ['candidate registration', registerCandidate, 'assertPeriodAllowsCreate'],
  ['candidate conversion', convertCandidate, 'assertPeriodAllowsCreate'],
  ['document issue', issueDocument, 'assertPeriodAllowsIssue'],
  ['document cancellation', cancelDocument, 'assertPeriodAllowsCancel'],
  ['document replacement', replaceDocument, 'assertPeriodAllowsReplace'],
  ['document transition', transitionDocument, 'assertPeriodAllowsTransition'],
];

for (const [name, source, guardFunction] of guardedServices) {
  expectIncludes(source, [guardFunction], name);
  assert.ok(
    source.indexOf(guardFunction) > source.indexOf('prisma.$transaction'),
    `${name} must enforce the period guard inside its transaction boundary`,
  );
}

assert.ok(
  registerCandidate.indexOf('findByRegistrationKey') <
    registerCandidate.lastIndexOf('assertPeriodAllowsCreate'),
  'candidate registration must preserve idempotent replay before period lock enforcement',
);

console.log('output-tax-period-authority.contract.test.js: PASS');
