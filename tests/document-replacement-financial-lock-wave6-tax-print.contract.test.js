'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  assertReplacementMatchesTaxAuthority,
  buildFallbackLines,
  parseDocumentPreparationSourceId,
} = require('../src/modules/tax/documents/print/documentPreparationReplacementTaxProjection');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const service = read('src/modules/tax/documents/print/projectOutputTaxPrintableDocumentService.js');
const helper = read('src/modules/tax/documents/print/documentPreparationReplacementTaxProjection.js');

assert.deepStrictEqual(parseDocumentPreparationSourceId('2:IN_BUDGET'), {
  preparationId: 2,
  portion: 'IN_BUDGET',
});
assert.deepStrictEqual(parseDocumentPreparationSourceId('2:OUT_OF_BUDGET'), {
  preparationId: 2,
  portion: 'OUT_OF_BUDGET',
});
assert.throws(
  () => parseDocumentPreparationSourceId('2:OTHER'),
  (error) => error?.code === 'DOCUMENT_REPLACEMENT_TAX_SOURCE_INVALID',
);

const financialLock = {
  portions: [
    {
      portion: 'IN_BUDGET',
      taxInvoiceKind: 'FULL',
      subtotalAmount: 3738.32,
      taxAmount: 261.68,
      totalAmount: 4000,
    },
    {
      portion: 'OUT_OF_BUDGET',
      taxInvoiceKind: 'SHORT',
      subtotalAmount: 934.58,
      taxAmount: 65.42,
      totalAmount: 1000,
    },
  ],
};

assert.doesNotThrow(() => assertReplacementMatchesTaxAuthority({
  replacement: { financialLock },
  portion: 'IN_BUDGET',
  document: {
    taxInvoiceKind: 'FULL',
    subtotalAmount: 3738.32,
    taxAmount: 261.68,
    totalAmount: 4000,
  },
}));

assert.throws(
  () => assertReplacementMatchesTaxAuthority({
    replacement: { financialLock },
    portion: 'IN_BUDGET',
    document: {
      taxInvoiceKind: 'FULL',
      subtotalAmount: 3738.32,
      taxAmount: 261.68,
      totalAmount: 3999.99,
    },
  }),
  (error) => error?.code === 'DOCUMENT_REPLACEMENT_TAX_FINANCIAL_AUTHORITY_CHANGED',
);

const fallback = buildFallbackLines({
  portion: 'IN_BUDGET',
  documentSnapshot: {
    items: [{ description: 'วัสดุสำนักงาน', quantity: 2, unitName: 'ชุด', unitPrice: 2000, amount: 4000 }],
  },
});
assert.strictEqual(fallback.length, 1);
assert.strictEqual(fallback[0].lineAmount, 4000);
assert.strictEqual(fallback[0].replacementLine, false);

assert.match(service, /sourceType === 'DOCUMENT_PREPARATION'/);
assert.match(service, /projectDocumentPreparationTaxPrintable/);
assert.match(service, /loadDocumentPreparationReplacementTaxProjection/);
assert.match(service, /documentHeader\(\{ document, purpose, replacement \}\)/);
assert.match(service, /subtotalAmount: amount\(document\.subtotalAmount\)/);
assert.match(service, /taxAmount: amount\(document\.taxAmount\)/);
assert.match(service, /totalAmount: amount\(document\.totalAmount\)/);
assert.match(service, /replacementProjection: replacement/);
assert.match(service, /sourcePreparation:/);

assert.match(helper, /currentKey = `\$\{Number\(branchId\)\}:\$\{source\.preparationId\}:CURRENT`/);
assert.match(helper, /replacement\.status !== 'LOCKED'/);
assert.match(helper, /replacement\.finalSnapshot/);
assert.match(helper, /DOCUMENT_REPLACEMENT_TAX_FINANCIAL_AUTHORITY_CHANGED/);
assert.match(helper, /DOCUMENT_REPLACEMENT_TAX_LINE_TOTAL_CHANGED/);
assert.match(helper, /source\.portion/);
assert.doesNotMatch(helper, /taxDocument\.update|outputVatRecord\.update|taxPeriod\.update/);

console.log('Document replacement financial lock Wave 6 tax print contract: PASS');
