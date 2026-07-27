const assert = require('node:assert/strict')

const QuickReceiptSessionService = require('./QuickReceiptSessionService')

const service = new QuickReceiptSessionService({})

const structuredLine = service.normalizeItemPayload({
  productId: '101',
  quantity: 2,
  costPrice: '450.50',
  priceRetail: '590',
  priceWholesale: '550',
  note: 'รับตามใบส่งของ DN-001',
  items: [
    { barcode: ' BC-001 ', serialNumber: ' SN-001 ' },
    { barcode: 'BC-002', serialNumber: '' },
  ],
})

assert.deepEqual(structuredLine, {
  productId: 101,
  quantity: 2,
  costPrice: 450.5,
  priceRetail: 590,
  priceWholesale: 550,
  priceTechnician: null,
  priceOnline: null,
  note: 'รับตามใบส่งของ DN-001',
  items: [
    { barcode: 'BC-001', serialNumber: 'SN-001' },
    { barcode: 'BC-002', serialNumber: null },
  ],
})

const simpleLine = service.normalizeItemPayload({
  productId: 202,
  quantity: 5,
  costPrice: 100,
  priceRetail: 150,
  items: [],
})

assert.equal(simpleLine.quantity, 5)
assert.deepEqual(simpleLine.items, [])

assert.throws(
  () => service.normalizeItemPayload({ costPrice: 100, priceRetail: 150, quantity: 1 }),
  (error) => error.code === 'PRODUCT_REQUIRED' && error.statusCode === 400
)
assert.throws(
  () => service.normalizeItemPayload({ productId: 1, costPrice: 0, priceRetail: 150, quantity: 1 }),
  (error) => error.code === 'COST_PRICE_REQUIRED'
)
assert.throws(
  () => service.normalizeItemPayload({ productId: 1, costPrice: 100, priceRetail: 0, quantity: 1 }),
  (error) => error.code === 'PRICE_RETAIL_REQUIRED'
)
assert.throws(
  () => service.normalizeItemPayload({ productId: 1, costPrice: 100, priceRetail: 150, quantity: 0 }),
  (error) => error.code === 'QUANTITY_REQUIRED'
)

console.log('✅ QuickReceiptSessionService business contract passed')
