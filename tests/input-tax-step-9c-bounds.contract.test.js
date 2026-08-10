'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const reportService = read('src/modules/reporting/tax/input/runtime/inputTaxReportRuntimeService.js');
const reportRepository = read('src/modules/reporting/tax/input/runtime/inputTaxReportRuntimeRepository.js');
const reportController = read('src/modules/reporting/tax/input/runtime/inputTaxReportRuntimeController.js');
const overviewController = read('src/modules/tax/inputDocuments/overview/inputTaxOverviewController.js');
const overviewRepository = read('src/modules/tax/inputDocuments/overview/inputTaxOverviewRepository.js');

assert.match(reportService, /MAX_REPORT_RANGE_DAYS = 366/);
assert.match(reportService, /MAX_REPORT_ROWS = 2000/);
assert.match(reportService, /INPUT_TAX_REPORT_RANGE_TOO_LARGE/);
assert.match(reportService, /INPUT_TAX_REPORT_RESULT_TOO_LARGE/);
assert.match(reportService, /QUERY_TAKE = MAX_REPORT_ROWS \+ 1/);
assert.match(reportRepository, /take,/);
assert.match(reportRepository, /documentNumber: 'asc'/);
assert.match(reportRepository, /id: 'asc'/);
assert.match(reportController, /error\?\.code/);
assert.match(reportController, /error\?\.details/);
assert.match(reportController, /statusCode < 500/);

assert.match(overviewController, /MAX_OVERVIEW_RANGE_DAYS = 366/);
assert.match(overviewController, /INPUT_TAX_OVERVIEW_RANGE_TOO_LARGE/);
assert.match(overviewRepository, /ORDER BY \$\{selectedPeriodExpression\} DESC, document\."id" DESC/);

console.log('input tax step 9c bounded query contract evidence: PASS');
