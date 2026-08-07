'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const service = read(
  'src/modules/tax/documents/print/projectOutputTaxPrintableDocumentService.js',
);
const contract = read('tests/output-tax-print-projection.contract.test.js');

assert.match(service, /documentType !== 'OUTPUT_TAX_INVOICE'/);
assert.match(service, /document\.status !== 'REGISTERED'/);
assert.match(service, /document\.candidate\?\.sourceType !== 'SALE'/);
assert.match(service, /sale\.paid !== true/);
assert.match(service, /sale\.statusPayment !== 'PAID'/);
assert.match(service, /const invoiceKind = document\.taxInvoiceKind/);

assert.match(service, /const purposeCode\s*=\s*invoiceKind === 'FULL'[\s\S]*?'FULL_TAX_INVOICE'[\s\S]*?:\s*'SHORT_TAX_INVOICE'/);
assert.match(service, /ResolvePrintDocumentPurposeService/);
assert.match(service, /branchId:\s*normalizedBranchId/);
assert.match(service, /code:\s*purposeCode/);
assert.match(service, /type:\s*purpose\.code/);
assert.match(service, /title:\s*purpose\.displayName/);

assert.match(contract, /FULL_TAX_INVOICE/);
assert.match(contract, /SHORT_TAX_INVOICE/);

assert.doesNotMatch(service, /title:\s*invoiceKind === 'FULL'/);
assert.doesNotMatch(service, /CustomerReceipts/);
assert.doesNotMatch(service, /customerReceipt/i);

console.log('Output tax document-purpose authority discovery contract: PASS');
