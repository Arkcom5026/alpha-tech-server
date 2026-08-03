'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const creditNoteProjection = fs.readFileSync(
  path.join(root, 'src/modules/tax/documents/creditNote/print/projectOutputTaxCreditNotePrintableDocumentService.js'),
  'utf8',
);
const printableDispatcher = fs.readFileSync(
  path.join(root, 'src/modules/tax/documents/print/projectOutputTaxPrintableDocumentService.js'),
  'utf8',
);

assert.match(creditNoteProjection, /OUTPUT_TAX_CREDIT_NOTE/);
assert.match(creditNoteProjection, /TAX_CREDIT_NOTE_NOT_PRINTABLE/);
assert.match(creditNoteProjection, /TAX_CREDIT_NOTE_PROJECTION_INTEGRITY_FAILED/);
assert.match(creditNoteProjection, /originalTaxDocument/);
assert.match(creditNoteProjection, /saleReturn/);
assert.match(creditNoteProjection, /title: 'ใบลดหนี้'/);
assert.match(creditNoteProjection, /refundedAmount/);
assert.match(printableDispatcher, /projectOutputTaxCreditNotePrintableDocument/);
assert.match(printableDispatcher, /OUTPUT_TAX_CREDIT_NOTE/);

console.log('Output tax credit-note print projection contract: PASS');
