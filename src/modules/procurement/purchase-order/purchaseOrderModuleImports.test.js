const test = require('node:test');
const assert = require('node:assert/strict');

test('purchase-order query slices resolve their shared module', () => {
  const list = require('./query/list/listPurchaseOrdersSlice');
  const bySupplier = require('./query/by-supplier/listPurchaseOrdersBySupplierSlice');
  const detail = require('./query/detail/getPurchaseOrderSlice');

  assert.equal(typeof list.handle, 'function');
  assert.equal(typeof bySupplier.handle, 'function');
  assert.equal(typeof detail.handle, 'function');
});
