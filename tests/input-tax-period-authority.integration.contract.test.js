'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const filingRepository = read('src/modules/tax/inputDocuments/filing/inputTaxFilingRepository.js');
const filingService = read('src/modules/tax/inputDocuments/filing/inputTaxFilingService.js');
const overviewContract = read('src/modules/tax/inputDocuments/overview/inputTaxOverviewContract.js');
const agenda = read('docs/tax/input-tax-complete-agenda.md');

assert.match(filingRepository, /findBatchPeriodAuthority/);
assert.match(filingRepository, /LEFT JOIN "TaxPeriod"/);
assert.match(filingRepository, /CONCAT\(batch\."year", '-', LPAD\(batch\."month"::text, 2, '0'\)\)/);
assert.match(filingService, /PERIOD_MUTATION_BLOCKED_STATUSES/);
assert.match(filingService, /CLOSED.*LOCKED.*SUBMITTED/);
assert.match(filingService, /assertBatchPeriodMutable/);
assert.match(filingService, /removeTaxDocumentFromFiling/);
assert.match(overviewContract, /periodAuthority/);
assert.match(overviewContract, /INPUT_TAX_OVERVIEW_V1/);
assert.match(agenda, /Owner Production-Verification Checklist/);

console.log('input tax period authority integration contract: PASS');
