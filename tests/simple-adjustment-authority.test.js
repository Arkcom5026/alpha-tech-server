const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { assertProductCanAdjustSimpleStock } = require('../src/modules/inventory/policies/productInventoryMutationPolicy')
const { parseSimpleStockAdjustmentInput } = require('../src/modules/inventory/simple-stock/adjust/simpleStockAdjustmentInput')

assert.deepStrictEqual(
  assertProductCanAdjustSimpleStock({ mode: 'SIMPLE', inventoryBehavior: 'TRACKED' }),
  { mode: 'SIMPLE', noSN: true, trackSerialNumber: false, inventoryBehavior: 'TRACKED' }
)
assert.throws(
  () => assertProductCanAdjustSimpleStock({ mode: 'SIMPLE', inventoryBehavior: 'NON_STOCK' }),
  (error) => error.code === 'NON_STOCK_PRODUCT_CANNOT_BE_ADJUSTED'
)
assert.throws(
  () => assertProductCanAdjustSimpleStock({ mode: 'STRUCTURED', inventoryBehavior: 'TRACKED' }),
  (error) => error.code === 'SIMPLE_ADJUSTMENT_REQUIRES_SIMPLE_MODE'
)
assert.deepStrictEqual(
  parseSimpleStockAdjustmentInput({ productId: '12', qtyDelta: '-2.5', note: 'Damaged during count', refType: 'STOCK_COUNT', refId: '8' }),
  { productId: 12, qtyDelta: -2.5, unitCost: null, refType: 'STOCK_COUNT', refId: 8, note: 'Damaged during count' }
)
assert.throws(
  () => parseSimpleStockAdjustmentInput({ productId: 12, qtyDelta: 1 }),
  (error) => error.code === 'SIMPLE_ADJUSTMENT_REASON_REQUIRED'
)

const root = path.join(__dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const routes = read('src/modules/inventory/simple-stock/routes/simpleStockRoutes.js')
const server = read('server.js')
const service = read('src/modules/inventory/simple-stock/adjust/simpleStockAdjustmentService.js')
const repository = read('src/modules/inventory/simple-stock/adjust/simpleStockAdjustmentRepository.js')
const controller = read('src/modules/inventory/simple-stock/adjust/simpleStockAdjustmentController.js')
assert(routes.includes("require('../adjust/simpleStockAdjustmentController')"))
assert(routes.includes("router.post('/adjustments', createSimpleAdjustment)"))
assert(server.includes("require('./src/modules/inventory/simple-stock/routes/simpleStockRoutes')"))
assert(server.includes("app.use('/api/simple-stock', simpleStockRoutes)"))
assert(service.includes('assertProductCanAdjustSimpleStock(product)'))
assert(service.includes("type: 'ADJUST'"))
assert(service.includes('findActiveLots'))
assert(service.includes('SIMPLE_LOT_BALANCE_MISMATCH'))
assert(service.includes('INSUFFICIENT_AVAILABLE_STOCK_FOR_ADJUSTMENT'))
assert(service.includes('nextAverageCost'))
assert(controller.includes('SIMPLE_STOCK_ADJUSTMENT_FORBIDDEN'))
assert(controller.includes("require('../../../employee/authorization/employeePositionAuthority')"))
assert(controller.includes('POSITION_CAPABILITIES.INVENTORY_ADJUST'))
assert(controller.includes('hasCapability('))
assert(!controller.includes("['OWNER', 'MANAGER'].includes(req.user?.employeeRole)"))
assert(repository.includes("isolationLevel: 'Serializable'"))
assert(repository.includes("orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }]"))
assert(repository.includes("qtyRemaining: { gt: 0 }"))
console.log('✅ SIMPLE adjustment authority certification passed')
