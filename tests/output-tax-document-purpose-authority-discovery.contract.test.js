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
assert.match(service, /invoiceKind === 'FULL' \? 'FULL_TAX_INVOICE' : 'SHORT_TAX_INVOICE'/);
assert.match(service, /invoiceKind === 'FULL' \? 'ใบกำกับภาษี' : 'ใบกำกับภาษีอย่างย่อ'/);

assert.match(contract, /FULL_TAX_INVOICE/);
assert.match(contract, /SHORT_TAX_INVOICE/);

assert.doesNotMatch(service, /CustomerReceipts/);
assert.doesNotMatch(service, /customerReceipt/i);

console.log('Output tax document-purpose authority discovery contract: PASS');
