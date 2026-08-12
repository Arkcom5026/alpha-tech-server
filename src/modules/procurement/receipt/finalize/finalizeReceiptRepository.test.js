const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computePoStatusFromItems,
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
