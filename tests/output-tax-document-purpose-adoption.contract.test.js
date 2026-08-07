'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const service = read('src/modules/tax/documents/print/projectOutputTaxPrintableDocumentService.js');

assert.match(service, /ResolvePrintDocumentPurposeService/);
assert.match(service, /invoiceKind === 'FULL'[\s\S]*'FULL_TAX_INVOICE'[\s\S]*'SHORT_TAX_INVOICE'/);
assert.match(service, /branchId:\s*normalizedBranchId,\s*code:\s*purposeCode/s);
assert.match(service, /type:\s*purpose\.code/);
assert.match(service, /title:\s*purpose\.displayName/);
assert.doesNotMatch(service, /title:\s*invoiceKind === 'FULL'/);

// Existing tax lifecycle and financial projection remain authoritative.
assert.match(service, /document\.documentType !== 'OUTPUT_TAX_INVOICE'/);
assert.match(service, /document\.status !== 'REGISTERED'/);
assert.match(service, /sale\.paid !== true/);
assert.match(service, /sale\.statusPayment !== 'PAID'/);
assert.match(service, /subtotalAmount:\s*amount\(document\.subtotalAmount\)/);
assert.match(service, /taxAmount:\s*amount\(document\.taxAmount\)/);
assert.match(service, /totalAmount:\s*amount\(document\.totalAmount\)/);

console.log('Output tax document-purpose adoption contract: PASS');
