const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  assertProductCanReceive,
  resolveProductInventoryPolicy,
} = require('../src/modules/inventory/policies/productInventoryMutationPolicy')

const trackedSimple = assertProductCanReceive({
  mode: 'SIMPLE',
  inventoryBehavior: 'TRACKED',
})
assert.deepStrictEqual(trackedSimple, {
  mode: 'SIMPLE',
  noSN: true,
  trackSerialNumber: false,
  inventoryBehavior: 'TRACKED',
})

const legacySimple = resolveProductInventoryPolicy({ mode: 'SIMPLE' })
assert.strictEqual(legacySimple.inventoryBehavior, 'TRACKED')

assert.throws(
  () => assertProductCanReceive({ mode: 'SIMPLE', inventoryBehavior: 'NON_STOCK' }),
  (error) => error.code === 'NON_STOCK_PRODUCT_CANNOT_BE_RECEIVED' && error.statusCode === 400
)

assert.throws(
  () => assertProductCanReceive({ mode: 'STRUCTURED', inventoryBehavior: 'NON_STOCK' }),
  (error) => error.code === 'NON_STOCK_REQUIRES_SIMPLE_MODE'
)

const root = path.join(__dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const quickStock = read('src/modules/product/quickStock/services/QuickStockService.js')
const quickStockRepository = read('src/modules/product/quickStock/repositories/quickStockRepository.js')
const procurementReceipt = read('src/modules/procurement/receipt/commit/commitReceiptRepository.js')
const stockItemReceive = read('src/modules/inventory/stock-item/receive/stockItemReceiveSlices.js')

assert(!quickStock.includes('AIO_06_CREATE_STOCK_ITEMS_FOR_SIMPLE'))
assert(quickStock.includes('const runtimePolicy = decideOperationalProductMode('))
assert(quickStock.includes('assertProductCanReceive(runtimePolicy)'))
assert(!quickStock.includes('const runtimePolicy = assertProductCanReceive(product)'))
assert(quickStockRepository.includes('inventoryBehavior: true'))
assert(procurementReceipt.includes('assertProductCanReceive(product)'))
assert(procurementReceipt.includes("refType: 'PURCHASE_RECEIPT'"))
assert(stockItemReceive.includes('assertProductCanReceive(product)'))
assert(stockItemReceive.includes('pendingEntries.forEach((entry) => assertProductCanReceive'))
assert((stockItemReceive.match(/tx\.simpleLot\.create/g) || []).length >= 2)
assert((stockItemReceive.match(/tx\.stockMovement\.create/g) || []).length >= 2)

console.log('✅ SIMPLE receive authority certification passed')
