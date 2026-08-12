const test = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyBarcodeIdentity,
  summarizeReceiptPending,
} = require('./barcodeScanSerialService');

test('STRUCTURED receipt identity is classified as SN from product mode even when kind is missing', () => {
  const item = {
    kind: null,
    stockItemId: null,
    simpleLotId: null,
    receiptItem: {
      purchaseOrderItem: { product: { mode: 'STRUCTURED' } },
    },
  };

  assert.equal(classifyBarcodeIdentity(item), 'SN');
});

test('SIMPLE receipt identity is classified as LOT from product mode even when kind is stale', () => {
  const item = {
    kind: 'SN',
    stockItemId: null,
    simpleLotId: null,
    receiptItem: {
      purchaseOrderItem: { product: { mode: 'SIMPLE' } },
    },
  };

  assert.equal(classifyBarcodeIdentity(item), 'LOT');
});

test('pending STRUCTURED identities remain visible before StockItem linkage', () => {
  const summary = summarizeReceiptPending({
    barcodeReceiptItem: [
      {
        kind: null,
        stockItemId: null,
        simpleLotId: null,
        status: 'READY',
        receiptItem: { purchaseOrderItem: { product: { mode: 'STRUCTURED' } } },
      },
      {
        kind: 'SN',
        stockItemId: 991,
        simpleLotId: null,
        status: 'SN_RECEIVED',
        receiptItem: { purchaseOrderItem: { product: { mode: 'STRUCTURED' } } },
      },
    ],
  });

  assert.deepEqual(summary, {
    totalSN: 2,
    scannedSN: 1,
    pendingSN: 1,
    totalLOT: 0,
    activatedLOT: 0,
    pendingLOT: 0,
    pendingTotal: 1,
  });
});

test('pending SIMPLE identity remains visible until LOT is activated', () => {
  const summary = summarizeReceiptPending({
    barcodeReceiptItem: [
      {
        kind: 'SN',
        stockItemId: null,
        simpleLotId: null,
        status: 'READY',
        receiptItem: { purchaseOrderItem: { product: { mode: 'SIMPLE' } } },
      },
    ],
  });

  assert.equal(summary.pendingSN, 0);
  assert.equal(summary.pendingLOT, 1);
  assert.equal(summary.pendingTotal, 1);
});
