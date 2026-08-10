'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const filingRepository = read('src/modules/tax/inputDocuments/filing/inputTaxFilingRepository.js');
const filingService = read('src/modules/tax/inputDocuments/filing/inputTaxFilingService.js');
const filingController = read('src/modules/tax/inputDocuments/filing/inputTaxFilingController.js');
const decisionService = read('src/modules/tax/inputDocuments/decisions/inputTaxDecisionService.js');
const periodRepository = read('src/modules/tax/periods/taxPeriodRepository.js');
const periodService = read('src/modules/tax/periods/taxPeriodService.js');

assert.match(filingRepository, /FOR UPDATE OF batch/);
assert.match(filingRepository, /lockTaxDocumentForFiling/);
assert.match(filingRepository, /lockInputVatAuthorityForFiling/);
assert.match(filingRepository, /FROM "InputVatRecord"/);
assert.match(filingRepository, /findBatchDocumentItemForUpdate/);
assert.match(filingRepository, /status" = 'SUBMITTED'/);
assert.match(filingService, /prisma\.\$transaction/);
assert.match(filingService, /INPUT_TAX_STALE_VERSION/);
assert.match(filingService, /INPUT_TAX_REASON_REQUIRED/);
assert.match(filingService, /replayed: true/);
assert.match(filingService, /authority\.batchStatus === 'SUBMITTED'/);
assert.match(filingService, /PERIOD_FILING_SUBMIT_BLOCKED_STATUSES = new Set\(\['CLOSED', 'SUBMITTED'\]\)/);
assert.match(filingService, /assertLockedBatchSubmittable\(authority\)/);
assert.match(filingService, /INPUT_TAX_FILING_VAT_AUTHORITY_REQUIRED/);
assert.match(filingService, /INPUT_TAX_FILING_VAT_AUTHORITY_CONFLICT/);
assert.match(filingService, /eligibleVat > Number\(authorityVat\)/);
assert.match(filingService, /inputVatRecordId: vatAuthority\.id/);
assert.match(filingService, /claimedSubtotalAmount = authorityAmounts\.authoritySubtotal/);
assert.match(filingController, /expectedVersion: req\.body\?\.version \?\? req\.body\?\.expectedVersion/);
assert.match(filingController, /branchId: authority\.branchId/);

assert.match(decisionService, /replayed: true/);
assert.match(decisionService, /lockIds = \[normalizedDocumentId, normalizedReplacedId\]\.sort/);
assert.doesNotMatch(decisionService, /Promise\.all\(\[\s*repository\.findForUpdate/);

assert.match(periodRepository, /AND "status" = \$5::"TaxPeriodStatus"/);
assert.match(periodService, /expectedStatus: current\.status/);
assert.match(periodService, /TAX_PERIOD_STALE_VERSION/);
assert.match(periodService, /latest\.status === targetStatus/);
assert.match(periodService, /countIncompleteInputTaxFilingRecords/);
assert.match(periodService, /TAX_PERIOD_INPUT_FILING_INCOMPLETE/);
assert.match(periodService, /prisma\.inputTaxFilingBatch\.count/);
assert.match(periodService, /TAX_PERIOD_INPUT_FILING_NOT_SUBMITTED/);
assert.match(periodService, /InputTaxFilingItemStatus/);
assert.match(periodService, /InputTaxFilingStatus/);

console.log('input tax step 9b concurrency/replay contract evidence: PASS');
