const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computePoStatusFromItems,
  computeIdentityCoverageFromItems,
  expectedIdentityCountForReceiptItem,
  isInventoryReceivedRow,
} = require('./finalizeReceiptRepository');

test('structured PO stays PARTIALLY_RECEIVED when one RC is complete but PO still has ordered quantity outstanding', () => {
  const status = computePoStatusFromItems([
    {
      quantity: 10,
      receipts: [
        {
          quantity: 5,
          barcodeReceiptItem: [
            { kind: 'SN', stockItemId: 1, status: 'SN_RECEIVED' },
            { kind: 'SN', stockItemId: 2, status: 'SN_RECEIVED' },
            { kind: 'SN', stockItemId: 3, status: 'SN_RECEIVED' },
            { kind: 'SN', stockItemId: 4, status: 'SN_RECEIVED' },
            { kind: 'SN', stockItemId: 5, status: 'SN_RECEIVED' },
          ],
        },
      ],
    },
  ]);

  assert.equal(status, 'PARTIALLY_RECEIVED');
});

test('structured PO becomes COMPLETED only after stock evidence covers full ordered quantity across RCs', () => {
  const makeRows = (start, amount) => Array.from({ length: amount }, (_, index) => ({
    kind: 'SN',
    stockItemId: start + index,
    status: 'SN_RECEIVED',
  }));

  const status = computePoStatusFromItems([
    {
      quantity: 10,
      receipts: [
        { quantity: 5, barcodeReceiptItem: makeRows(1, 5) },
        { quantity: 5, barcodeReceiptItem: makeRows(6, 5) },
      ],
    },
  ]);

  assert.equal(status, 'COMPLETED');
});

test('prepared barcodes without StockItem evidence do not advance PO status', () => {
  const status = computePoStatusFromItems([
    {
      quantity: 2,
      receipts: [
        {
          quantity: 2,
          barcodeReceiptItem: [
            { kind: 'SN', stockItemId: null, status: 'READY' },
            { kind: 'SN', stockItemId: null, status: 'READY' },
          ],
        },
      ],
    },
  ]);

  assert.equal(status, 'PENDING');
});

test('simple LOT contributes its receipt quantity only after actual lot linkage', () => {
  assert.equal(isInventoryReceivedRow({ kind: 'LOT', simpleLotId: null, status: 'SN_RECEIVED' }), false);
  assert.equal(isInventoryReceivedRow({ kind: 'LOT', simpleLotId: 50, status: 'SN_RECEIVED' }), true);

  const partial = computePoStatusFromItems([
    {
      quantity: 10,
      receipts: [
        {
          quantity: 4,
          barcodeReceiptItem: [
            { kind: 'LOT', simpleLotId: 50, status: 'SN_RECEIVED' },
          ],
        },
      ],
    },
  ]);

  const complete = computePoStatusFromItems([
    {
      quantity: 10,
      receipts: [
        {
          quantity: 4,
          barcodeReceiptItem: [
            { kind: 'LOT', simpleLotId: 50, status: 'SN_RECEIVED' },
          ],
        },
        {
          quantity: 6,
          barcodeReceiptItem: [
            { kind: 'LOT', simpleLotId: 51, status: 'SN_RECEIVED' },
          ],
        },
      ],
    },
  ]);

  assert.equal(partial, 'PARTIALLY_RECEIVED');
  assert.equal(complete, 'COMPLETED');
});

test('over-receipt evidence is capped at PO ordered quantity for completion', () => {
  const status = computePoStatusFromItems([
    {
      quantity: 2,
      receipts: [
        {
          quantity: 3,
          barcodeReceiptItem: [
            { kind: 'SN', stockItemId: 1, status: 'SN_RECEIVED' },
            { kind: 'SN', stockItemId: 2, status: 'SN_RECEIVED' },
            { kind: 'SN', stockItemId: 3, status: 'SN_RECEIVED' },
          ],
        },
      ],
    },
  ]);

  assert.equal(status, 'COMPLETED');
});

test('structured receipt identity coverage requires one active SN identity per unit', () => {
  assert.equal(expectedIdentityCountForReceiptItem({ quantity: 3, mode: 'STRUCTURED' }), 3);

  const coverage = computeIdentityCoverageFromItems([
    {
      quantity: 3,
      product: { mode: 'STRUCTURED' },
      barcodeReceiptItem: [
        { kind: 'SN', status: 'SN_RECEIVED' },
        { kind: 'SN', status: 'READY' },
        { kind: 'SN', status: 'VOID' },
      ],
    },
  ]);

  assert.deepEqual(coverage, { expected: 3, active: 2, missing: 1 });
});

test('simple receipt identity coverage requires one active LOT identity regardless of quantity', () => {
  assert.equal(expectedIdentityCountForReceiptItem({ quantity: 20, mode: 'SIMPLE' }), 1);

  const coverage = computeIdentityCoverageFromItems([
    {
      quantity: 20,
      product: { mode: 'SIMPLE' },
      barcodeReceiptItem: [
        { kind: 'LOT', status: 'SN_RECEIVED' },
        { kind: 'LOT', status: 'VOID' },
      ],
    },
  ]);

  assert.deepEqual(coverage, { expected: 1, active: 1, missing: 0 });
});

test('wrong barcode kind does not satisfy receipt identity coverage', () => {
  const coverage = computeIdentityCoverageFromItems([
    {
      quantity: 2,
      purchaseOrderItem: { product: { mode: 'STRUCTURED' } },
      barcodeReceiptItem: [
        { kind: 'LOT', status: 'SN_RECEIVED' },
        { kind: 'SN', status: 'SN_RECEIVED' },
      ],
    },
  ]);

  assert.deepEqual(coverage, { expected: 2, active: 1, missing: 1 });
});
