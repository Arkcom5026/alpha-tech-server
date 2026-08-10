const test = require('node:test');
const assert = require('node:assert/strict');
const { mapSerializedPartMovement } = require('./repairJobDetailService');

test('projects serialized repair part identity from stock movement ledger', () => {
  const result = mapSerializedPartMovement({
    id: 501,
    productId: 12,
    qty: '-1',
    stockItemId: 90,
    previousStockStatus: 'IN_STOCK',
    resultingStockStatus: 'USED',
    occurredAt: new Date('2026-08-10T10:00:00Z'),
    performedByEmployeeId: 4,
    stockItem: {
      id: 90,
      barcode: 'BC90',
      serialNumber: 'SN90',
      status: 'USED',
      product: { id: 12, name: 'SSD 1TB' },
    },
  });

  assert.equal(result.movementId, 501);
  assert.equal(result.productName, 'SSD 1TB');
  assert.equal(result.qtyUsed, 1);
  assert.equal(result.stockItemId, 90);
  assert.equal(result.serialNumber, 'SN90');
  assert.equal(result.previousStatus, 'IN_STOCK');
  assert.equal(result.status, 'USED');
});
