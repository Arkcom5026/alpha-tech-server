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

const assertProductCanReceive = (product = {}) => {
  const policy = resolveProductInventoryPolicy(product)

  if (policy.inventoryBehavior === PRODUCT_INVENTORY_BEHAVIOR.NON_STOCK) {
    throw inventoryMutationError('NON_STOCK_PRODUCT_CANNOT_BE_RECEIVED')
  }

  return policy
}

module.exports = {
  assertProductCanReceive,
  resolveProductInventoryPolicy,
}
