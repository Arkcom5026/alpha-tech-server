'use strict';

const assert = require('assert');
const {
  buildReplacementFinancialLock,
  assertReplacementFinancialLock,
} = require('../src/modules/sales/document-replacement/documentReplacementPolicy');

const sourceSnapshot = Object.freeze({
  schemaVersion: 1,
  preparationId: 2,
  source: {
    saleId: 1059,
    saleCode: 'SL-132608-0005',
    deliveryNoteNumber: 'DN-SL-132608-0005',
    totalAmount: 5000,
    taxAmount: 327.1,
    vatRate: 7,
  },
  totals: {
    sourceTotal: 5000,
    inBudgetTotal: 4000,
    outOfBudgetTotal: 1000,
  },
  taxProjection: [
    {
      portion: 'IN_BUDGET',
      taxInvoiceKind: 'FULL',
      totalAmount: 4000,
      lineType: 'MANUAL_DOCUMENT_LINES',
    },
    {
      portion: 'OUT_OF_BUDGET',
      taxInvoiceKind: 'SHORT',
      totalAmount: 1000,
      lineType: 'SERVICE_ONLY',
    },
  ],
  vatAllocation: [
    {
      portion: 'IN_BUDGET',
      subtotalAmount: 3738.32,
      taxAmount: 261.68,
      totalAmount: 4000,
    },
    {
      portion: 'OUT_OF_BUDGET',
      subtotalAmount: 934.58,
      taxAmount: 65.42,
      totalAmount: 1000,
    },
  ],
});

const taxDocuments = [
  {
    id: 170,
    issuedDocumentNumber: 'FULL-000170',
    snapshot: { portion: 'IN_BUDGET' },
  },
  {
    id: 171,
    issuedDocumentNumber: 'SHORT-000171',
    snapshot: { portion: 'OUT_OF_BUDGET' },
  },
];

const expectCode = (code, work) => {
  assert.throws(work, (error) => error?.code === code, `expected ${code}`);
};

(() => {
  const financialLock = buildReplacementFinancialLock({
    finalSnapshot: sourceSnapshot,
    taxDocuments,
    taxPeriodByDocumentId: {
      170: '2026-08',
      171: '2026-08',
    },
  });

  assert.deepStrictEqual(financialLock.source, {
    preparationId: 2,
    saleId: 1059,
    sourceTotal: 5000,
    sourceTaxAmount: 327.1,
    vatRate: 7,
  });

  assert.deepStrictEqual(financialLock.portions, [
    {
      portion: 'IN_BUDGET',
      taxInvoiceKind: 'FULL',
      lineType: 'MANUAL_DOCUMENT_LINES',
      subtotalAmount: 3738.32,
      taxAmount: 261.68,
      totalAmount: 4000,
      taxDocumentId: 170,
      issuedDocumentNumber: 'FULL-000170',
      taxPeriodId: '2026-08',
    },
    {
      portion: 'OUT_OF_BUDGET',
      taxInvoiceKind: 'SHORT',
      lineType: 'SERVICE_ONLY',
      subtotalAmount: 934.58,
      taxAmount: 65.42,
      totalAmount: 1000,
      taxDocumentId: 171,
      issuedDocumentNumber: 'SHORT-000171',
      taxPeriodId: '2026-08',
    },
  ]);

  const allowed = assertReplacementFinancialLock({
    financialLock,
    inBudgetLines: [
      { description: 'วัสดุสำนักงาน', quantity: 1, unitName: 'รายการ', unitPrice: 2500 },
      { description: 'วัสดุสิ้นเปลือง', quantity: 1, unitName: 'รายการ', unitPrice: 1500 },
    ],
    outOfBudgetLines: [
      { description: 'ค่าบริการ', quantity: 1, unitName: 'รายการ', unitPrice: 1000, lineType: 'SERVICE_ONLY' },
    ],
  });

  assert.deepStrictEqual(allowed, {
    allowed: true,
    sourceTotal: 5000,
    sourceTaxAmount: 327.1,
    inBudgetTotal: 4000,
    outOfBudgetTotal: 1000,
    total: 5000,
  });

  expectCode('DOCUMENT_REPLACEMENT_IN_BUDGET_TOTAL_CHANGED', () => {
    assertReplacementFinancialLock({
      financialLock,
      inBudgetLines: [
        { description: 'วัสดุสำนักงาน', quantity: 1, unitPrice: 4500 },
      ],
      outOfBudgetLines: [
        { description: 'ค่าบริการ', quantity: 1, unitPrice: 1000, lineType: 'SERVICE_ONLY' },
      ],
    });
  });

  expectCode('DOCUMENT_REPLACEMENT_OUT_OF_BUDGET_TOTAL_CHANGED', () => {
    assertReplacementFinancialLock({
      financialLock,
      inBudgetLines: [
        { description: 'วัสดุสำนักงาน', quantity: 1, unitPrice: 4000 },
      ],
      outOfBudgetLines: [
        { description: 'ค่าบริการ', quantity: 1, unitPrice: 500, lineType: 'SERVICE_ONLY' },
      ],
    });
  });

  expectCode('DOCUMENT_REPLACEMENT_OUT_OF_BUDGET_SERVICE_REQUIRED', () => {
    assertReplacementFinancialLock({
      financialLock,
      inBudgetLines: [
        { description: 'วัสดุสำนักงาน', quantity: 1, unitPrice: 4000 },
      ],
      outOfBudgetLines: [
        { description: 'สินค้า', quantity: 1, unitPrice: 1000, lineType: 'PRODUCT' },
      ],
    });
  });

  expectCode('DOCUMENT_REPLACEMENT_SOURCE_IDENTITY_FORBIDDEN', () => {
    assertReplacementFinancialLock({
      financialLock,
      inBudgetLines: [
        { description: 'วัสดุสำนักงาน', quantity: 1, unitPrice: 4000, productId: 999 },
      ],
      outOfBudgetLines: [
        { description: 'ค่าบริการ', quantity: 1, unitPrice: 1000, lineType: 'SERVICE_ONLY' },
      ],
    });
  });

  const equalSnapshot = {
    ...sourceSnapshot,
    source: { ...sourceSnapshot.source, totalAmount: 4000, taxAmount: 261.68 },
    totals: { sourceTotal: 4000, inBudgetTotal: 4000, outOfBudgetTotal: 0 },
    taxProjection: [sourceSnapshot.taxProjection[0]],
    vatAllocation: [sourceSnapshot.vatAllocation[0]],
  };
  const equalLock = buildReplacementFinancialLock({ finalSnapshot: equalSnapshot });
  assert.strictEqual(equalLock.portions.length, 1);
  assert.strictEqual(equalLock.portions[0].taxInvoiceKind, 'FULL');

  expectCode('DOCUMENT_REPLACEMENT_OUT_OF_BUDGET_NOT_ALLOWED', () => {
    assertReplacementFinancialLock({
      financialLock: equalLock,
      inBudgetLines: [{ description: 'วัสดุสำนักงาน', quantity: 1, unitPrice: 4000 }],
      outOfBudgetLines: [{ description: 'ค่าบริการ', quantity: 1, unitPrice: 1, lineType: 'SERVICE_ONLY' }],
    });
  });

  console.log('Document replacement financial lock Wave 0 contract: PASS');
})();
