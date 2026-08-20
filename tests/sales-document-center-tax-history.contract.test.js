'use strict';

const assert = require('assert');
const {
  projectTaxDocumentRow,
  taxRowMatchesKeyword,
  TAX_DOCUMENT_SOURCE_TYPE,
  OUTPUT_TAX_FULL_SOURCE_KIND,
  OUTPUT_TAX_SHORT_SOURCE_KIND,
} = require('../src/modules/finance/combined-billing/unifiedDocumentHistoryController');

const base = {
  id: 170,
  documentType: 'OUTPUT_TAX_INVOICE',
  documentNumber: 'DN-SL-132608-0005-BUDGET',
  counterpartyTaxId: '0123456789012',
  status: 'DRAFT',
  issuedAt: null,
  occurredAt: new Date('2026-08-20T07:46:00.000Z'),
  createdAt: new Date('2026-08-20T07:46:00.000Z'),
  totalAmount: 4000,
  snapshot: {
    sourceSaleId: 1059,
    sourceSaleCode: 'SL-132608-0005',
    sourceDeliveryNoteNumber: 'SL-132608-0005',
    requiredTaxInvoiceKind: 'FULL',
    counterpartyName: 'โรงพยาบาล',
    counterpartyTaxId: '0123456789012',
    recipient: { legalName: 'โรงพยาบาล', taxId: '0123456789012' },
  },
  taxInvoiceKind: null,
  issuedDocumentNumber: null,
  candidate: {
    sourceType: 'DOCUMENT_PREPARATION',
    sourceId: '1:IN_BUDGET',
    sourceDocumentNo: 'DN-SL-132608-0005-BUDGET',
  },
};

const draft = projectTaxDocumentRow(base);
assert.strictEqual(draft.id, 'tax-170');
assert.strictEqual(draft.rowKind, OUTPUT_TAX_FULL_SOURCE_KIND);
assert.strictEqual(draft.documentSourceType, TAX_DOCUMENT_SOURCE_TYPE);
assert.strictEqual(draft.documentSourceId, 170);
assert.strictEqual(draft.code, 'DN-SL-132608-0005-BUDGET');
assert.strictEqual(draft.customerName, 'โรงพยาบาล');
assert.strictEqual(draft.canManageTaxDocument, true);
assert.strictEqual(draft.canPrintTaxDocument, false);
assert.strictEqual(draft.grossAmount, 4000);
assert.strictEqual(taxRowMatchesKeyword(draft, 'SL-132608-0005'), true);
assert.strictEqual(taxRowMatchesKeyword(draft, 'โรงพยาบาล'), true);
assert.strictEqual(taxRowMatchesKeyword(draft, '0123456789012'), true);

const registered = projectTaxDocumentRow({
  ...base,
  status: 'REGISTERED',
  issuedAt: new Date('2026-08-20T11:55:00.000Z'),
  taxInvoiceKind: 'FULL',
  issuedDocumentNumber: 'TAX-000001',
});
assert.strictEqual(registered.code, 'TAX-000001');
assert.strictEqual(registered.canManageTaxDocument, false);
assert.strictEqual(registered.canPrintTaxDocument, true);
assert.strictEqual(registered.documentSourceId, 170, 'same TaxDocument id must remain the logical row identity');

const short = projectTaxDocumentRow({
  ...base,
  id: 171,
  documentNumber: 'DN-SL-132608-0005-SERVICE',
  status: 'REGISTERED',
  taxInvoiceKind: 'SHORT',
  issuedDocumentNumber: 'ABB-000001',
  totalAmount: 1000,
  snapshot: {
    ...base.snapshot,
    requiredTaxInvoiceKind: 'SHORT',
    counterpartyName: null,
    recipient: null,
  },
  candidate: {
    sourceType: 'DOCUMENT_PREPARATION',
    sourceId: '1:OUT_OF_BUDGET',
    sourceDocumentNo: 'DN-SL-132608-0005-SERVICE',
  },
});
assert.strictEqual(short.rowKind, OUTPUT_TAX_SHORT_SOURCE_KIND);
assert.strictEqual(short.code, 'ABB-000001');
assert.strictEqual(short.grossAmount, 1000);

console.log('Sales Document Center tax history contract: PASS');
