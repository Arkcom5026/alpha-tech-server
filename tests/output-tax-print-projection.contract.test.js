'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const service = read('src/modules/tax/documents/print/projectOutputTaxPrintableDocumentService.js');
const controller = read('src/modules/tax/http/taxIntakeController.js');
const routes = read('src/modules/tax/http/taxIntakeRoutes.js');

assert.match(service, /OUTPUT_TAX_INVOICE/);
assert.match(service, /status !== 'REGISTERED'/);
assert.match(service, /taxInvoiceKind/);
assert.match(service, /issuerSnapshot/);
assert.match(service, /recipientSnapshot/);
assert.match(service, /sale\.paid !== true/);
assert.match(service, /sale\.statusPayment !== 'PAID'/);
assert.match(service, /simpleItems/);
assert.match(service, /branchId: normalizedBranchId/);
assert.match(service, /FULL_TAX_INVOICE/);
assert.match(service, /SHORT_TAX_INVOICE/);
assert.match(controller, /getPrintableOutputTaxDocument/);
assert.match(routes, /documents\/:taxDocumentId\/printable/);

console.log('Output tax print projection contract: PASS');
