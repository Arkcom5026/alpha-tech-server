const test = require('node:test');
const assert = require('node:assert/strict');

const { isReceiptItemFullyReceived } = require('./commitReceiptRepository');

test('SIMPLE receipt item is complete when its LOT is already linked', () => {
  assert.equal(isReceiptItemFullyReceived({
    mode: 'SIMPLE',
    item: {
      quantity: 5,
      barcodeReceiptItem: [
        { kind: 'LOT', simpleLotId: 42, status: 'SN_RECEIVED' },
      ],
    },
  }), true);
});

test('STRUCTURED receipt item is complete only after every unit has stock authority', () => {
  assert.equal(isReceiptItemFullyReceived({
    mode: 'STRUCTURED',
    item: {
      quantity: 2,
      barcodeReceiptItem: [
        { kind: 'SN', stockItemId: 101, status: 'SN_RECEIVED' },
        { kind: 'SN', stockItemId: 102, status: 'SN_RECEIVED' },
      ],
    },
  }), true);

  assert.equal(isReceiptItemFullyReceived({
    mode: 'STRUCTURED',
    item: {
      quantity: 2,
      barcodeReceiptItem: [
        { kind: 'SN', stockItemId: 101, status: 'SN_RECEIVED' },
        { kind: 'SN', stockItemId: null, status: 'READY' },
      ],
    },
  }), false);
});

test('receipt item is not complete before inventory receiving has happened', () => {
  assert.equal(isReceiptItemFullyReceived({
    mode: 'SIMPLE',
    item: {
      quantity: 3,
      barcodeReceiptItem: [
        { kind: 'LOT', simpleLotId: null, status: 'READY' },
      ],
    },
  }), false);
});
