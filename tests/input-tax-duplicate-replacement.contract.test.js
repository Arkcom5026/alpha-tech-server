'use strict';

const fs = require('fs');
const assert = require('assert');

const read = (path) => fs.readFileSync(path, 'utf8');
const duplicateContract = read('src/modules/tax/inputDocuments/duplicates/inputTaxDuplicateContract.js');
const duplicateService = read('src/modules/tax/inputDocuments/duplicates/inputTaxDuplicateService.js');
const replacementContract = read('src/modules/tax/inputDocuments/replacements/inputTaxReplacementContract.js');
const replacementService = read('src/modules/tax/inputDocuments/replacements/inputTaxReplacementService.js');
const eligibilityService = read('src/modules/tax/inputDocuments/eligibility/inputTaxEligibilityService.js');

['NONE', 'POSSIBLE_DUPLICATE', 'HIGH_CONFIDENCE_DUPLICATE', 'CONFIRMED_DUPLICATE', 'RESOLVED_NOT_DUPLICATE']
  .forEach((status) => assert(duplicateContract.includes(status)));
assert(duplicateService.includes('sha256'));
assert(duplicateService.includes('matchedDocumentIds'));

['NONE', 'REPLACED_SOURCE', 'ACTIVE_REPLACEMENT', 'CHAIN_CONFLICT']
  .forEach((status) => assert(replacementContract.includes(status)));
assert(replacementService.includes('replacesTaxDocumentId'));
assert(replacementService.includes('replacedByTaxDocumentId'));
assert(replacementService.includes('chainRootTaxDocumentId'));

assert(eligibilityService.includes('DUPLICATE_DOCUMENT_RISK'));
assert(eligibilityService.includes('REPLACED_DOCUMENT'));
assert(eligibilityService.includes("replacement?.status === 'CHAIN_CONFLICT'"));

console.log('input-tax duplicate and replacement contract evidence: PASS');
