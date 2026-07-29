'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const service = read('src/modules/tax/inputDocuments/overview/inputTaxOverviewService.js');

const assertIncludes = (value, expected, label) => {
  if (!value.includes(expected)) throw new Error(`${label}: expected ${expected}`);
};

assertIncludes(service, "projectInputTaxDuplicates", 'duplicate projection integration');
assertIncludes(service, "projectInputTaxReplacementChains", 'replacement projection integration');
assertIncludes(service, 'duplicateInvoiceRiskCount', 'duplicate quality metric');
assertIncludes(service, 'replacementDocumentCount', 'replacement quality metric');
assertIncludes(service, 'duplicateStatus', 'recent document duplicate status');
assertIncludes(service, 'replacementStatus', 'recent document replacement status');
assertIncludes(service, 'DUPLICATE_DOCUMENT_RISK', 'duplicate attention reason');
assertIncludes(service, 'REPLACED_DOCUMENT', 'replacement attention reason');
assertIncludes(service, 'MANUAL_REVIEW_REQUIRED', 'replacement conflict attention reason');

console.log('input-tax overview duplicate/replacement integration contract: PASS');
