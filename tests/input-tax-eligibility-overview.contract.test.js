'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const contract = read('src/modules/tax/inputDocuments/eligibility/inputTaxEligibilityContract.js');
const service = read('src/modules/tax/inputDocuments/eligibility/inputTaxEligibilityService.js');
const overview = read('src/modules/tax/inputDocuments/overview/inputTaxOverviewService.js');

for (const status of [
  'PENDING_REVIEW', 'ELIGIBLE', 'PARTIALLY_ELIGIBLE', 'INELIGIBLE',
  'DEFERRED', 'SELECTED_FOR_FILING', 'FILED',
]) assert.match(contract, new RegExp(status));
for (const field of [
  'grossVatAmount', 'eligibleVatAmount', 'ineligibleVatAmount', 'eligibilityRate',
]) assert.match(contract, new RegExp(field));
assert.match(service, /inputTaxEligibilityRate/);
assert.match(service, /PARTIAL_BUSINESS_USE/);
assert.match(service, /CANCELLED_DOCUMENT/);
assert.match(service, /REPLACED_DOCUMENT/);
assert.match(overview, /projectInputTaxEligibility/);
assert.match(overview, /eligibilityStatus/);
assert.match(overview, /selectedDocumentCount/);
assert.match(overview, /deferredDocumentCount/);
assert.match(overview, /sumEligibility/);

console.log('Input-tax eligibility and partial-claim overview contract: PASS');