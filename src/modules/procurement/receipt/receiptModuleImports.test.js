const test = require('node:test');
const assert = require('node:assert/strict');

test('purchase receipt route graph resolves at server startup', () => {
  const receiptRoutes = require('./routes/purchaseOrderReceiptRoutes');
  const receiptItemRoutes = require('./routes/purchaseOrderReceiptItemRoutes');

  assert.equal(typeof receiptRoutes, 'function');
  assert.equal(typeof receiptItemRoutes, 'function');
});
