const {
  PRODUCT_INVENTORY_BEHAVIOR,
  decideOperationalProductMode,
} = require('../../product/runtime/policies/operationalProductModePolicy')

const inventoryMutationError = (code) => {
  const error = new Error(code)
  error.code = code
  error.statusCode = 400
  return error
}

const resolveProductInventoryPolicy = (product = {}) =>
  decideOperationalProductMode({
    mode: product.mode,
    noSN: product.noSN,
    trackSerialNumber: product.trackSerialNumber,
    inventoryBehavior: product.inventoryBehavior,
  })

const assertTrackedProductOperation = (product, { nonStockCode, simpleOnlyCode } = {}) => {
  const policy = resolveProductInventoryPolicy(product)

  if (policy.inventoryBehavior === PRODUCT_INVENTORY_BEHAVIOR.NON_STOCK) {
    throw inventoryMutationError(nonStockCode)
  }

  if (simpleOnlyCode && policy.mode !== 'SIMPLE') {
    throw inventoryMutationError(simpleOnlyCode)
  }

  return policy
}

const assertProductCanReceive = (product = {}) =>
  assertTrackedProductOperation(product, {
    nonStockCode: 'NON_STOCK_PRODUCT_CANNOT_BE_RECEIVED',
  })

const assertProductCanAdjustSimpleStock = (product = {}) =>
  assertTrackedProductOperation(product, {
    nonStockCode: 'NON_STOCK_PRODUCT_CANNOT_BE_ADJUSTED',
    simpleOnlyCode: 'SIMPLE_ADJUSTMENT_REQUIRES_SIMPLE_MODE',
  })

module.exports = {
  assertProductCanAdjustSimpleStock,
  assertProductCanReceive,
  resolveProductInventoryPolicy,
}
