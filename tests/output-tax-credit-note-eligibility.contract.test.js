'use strict';

const assert = require('assert');
const {
  assertOutputTaxCreditNoteEligibility,
} = require('../src/modules/tax/documents/creditNote/saleReturnCreditNoteEligibilityPolicy');

const original = Object.freeze({
  id: 501,
  branchId: 11,
  documentType: 'OUTPUT_TAX_INVOICE',
  status: 'REGISTERED',
  issuerProfileId: 41,
  issuedDocumentNumber: 'FULL-000001',
  taxInvoiceKind: 'FULL',
  totalAmount: 107,
});

const completedFullReturn = Object.freeze({
  id: 81,
  branchId: 11,
  saleId: 701,
  status: 'COMPLETED',
  isFullyRefunded: true,
  refundedAmount: 107,
  deductedAmount: 0,
});

const eligible = assertOutputTaxCreditNoteEligibility({
  originalTaxDocument: original,
  saleReturn: completedFullReturn,
  sourceSaleId: 701,
  isFullSaleReturn: true,
});

assert.deepStrictEqual(eligible, {
  branchId: 11,
  originalTaxDocumentId: 501,
  saleReturnId: 81,
  originalInvoiceNumber: 'FULL-000001',
  taxInvoiceKind: 'FULL',
});

assert.throws(
  () => assertOutputTaxCreditNoteEligibility({
    originalTaxDocument: original,
    saleReturn: { ...completedFullReturn, branchId: 12 },
    sourceSaleId: 701,
    isFullSaleReturn: true,
  }),
  { code: 'TAX_CREDIT_NOTE_TENANT_MISMATCH' },
);

assert.throws(
  () => assertOutputTaxCreditNoteEligibility({
    originalTaxDocument: original,
    saleReturn: { ...completedFullReturn, refundedAmount: 100 },
    sourceSaleId: 701,
    isFullSaleReturn: true,
  }),
  { code: 'TAX_CREDIT_NOTE_FULL_REFUND_REQUIRED' },
);

assert.throws(
  () => assertOutputTaxCreditNoteEligibility({
    originalTaxDocument: original,
    saleReturn: completedFullReturn,
    sourceSaleId: 701,
    isFullSaleReturn: false,
  }),
  { code: 'TAX_CREDIT_NOTE_FULL_RETURN_REQUIRED' },
);

console.log('Output tax credit-note eligibility contract: PASS');
