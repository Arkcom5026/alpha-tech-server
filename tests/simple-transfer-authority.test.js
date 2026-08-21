const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  assertProductCanTransferSimpleStock,
} = require('../src/modules/inventory/policies/productInventoryMutationPolicy')
const {
  parseSimpleStockTransferInput,
} = require('../src/modules/inventory/simple-stock/transfer/simpleStockTransferInput')

assert.deepStrictEqual(
  assertProductCanTransferSimpleStock({ mode: 'SIMPLE', inventoryBehavior: 'TRACKED' }),
  { mode: 'SIMPLE', noSN: true, trackSerialNumber: false, inventoryBehavior: 'TRACKED' }
)
assert.throws(
  () => assertProductCanTransferSimpleStock({ mode: 'SIMPLE', inventoryBehavior: 'NON_STOCK' }),
  (error) => error.code === 'NON_STOCK_PRODUCT_CANNOT_BE_TRANSFERRED'
)
assert.throws(
  () => assertProductCanTransferSimpleStock({ mode: 'STRUCTURED', inventoryBehavior: 'TRACKED' }),
  (error) => error.code === 'SIMPLE_TRANSFER_REQUIRES_SIMPLE_MODE'
)

assert.deepStrictEqual(
  parseSimpleStockTransferInput(
    { productId: '12', targetBranchId: '3', quantity: '2.5', refId: '9', note: 'Rebalance stock' },
    'transfer-request-001'
  ),
  {
    sourceProductId: 12,
    targetBranchId: 3,
    targetProductId: null,
    quantity: 2.5,
    refId: 9,
    note: 'Rebalance stock',
    transferKey: 'transfer-request-001',
    movementRefType: 'SIMPLE_TRANSFER:transfer-request-001',
  }
)
assert.throws(
  () => parseSimpleStockTransferInput({ productId: 12, targetBranchId: 3, quantity: 1, note: 'x' }),
  (error) => error.code === 'SIMPLE_TRANSFER_IDEMPOTENCY_KEY_REQUIRED'
)

const root = path.join(__dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const routes = read('src/modules/inventory/simple-stock/routes/simpleStockRoutes.js')
const server = read('server.js')
const service = read('src/modules/inventory/simple-stock/transfer/simpleStockTransferService.js')
const repository = read('src/modules/inventory/simple-stock/transfer/simpleStockTransferRepository.js')
const controller = read('src/modules/inventory/simple-stock/transfer/simpleStockTransferController.js')

assert(routes.includes("router.post('/transfers', createSimpleTransfer)"))
assert(server.includes("require('./src/modules/inventory/simple-stock/routes/simpleStockRoutes')"))
assert(server.includes("app.use('/api/simple-stock', simpleStockRoutes)"))
assert(service.includes('assertProductCanTransferSimpleStock(sourceProduct)'))
assert(service.includes('TRANSFER_PRODUCT_IDENTITY_MISMATCH'))
assert(service.includes('INSUFFICIENT_AVAILABLE_STOCK_FOR_TRANSFER'))
assert(service.includes("type: 'TRANSFER'"))
assert(service.includes('incomingCost'))
assert(service.includes('SIMPLE_TRANSFER_IDEMPOTENCY_KEY_REUSED'))
assert(service.includes("createHash('sha256')"))
assert(repository.includes("isolationLevel: 'Serializable'"))
assert(repository.includes("orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }]"))
assert(repository.includes('findTransferMovements(refType)'))
assert(controller.includes('SIMPLE_STOCK_TRANSFER_FORBIDDEN'))
assert(controller.includes("require('../../../employee/authorization/employeePositionAuthority')"))
assert(controller.includes('POSITION_CAPABILITIES.INVENTORY_TRANSFER'))
assert(controller.includes('hasCapability('))
assert(!controller.includes("['OWNER', 'MANAGER'].includes(req.user?.employeeRole)"))
console.log('✅ SIMPLE transfer authority certification passed')
