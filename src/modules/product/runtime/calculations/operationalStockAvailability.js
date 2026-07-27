const calcAvailable = (stockBalance) => {
  const quantity = Number(stockBalance?.quantity ?? 0)
  const reserved = Number(stockBalance?.reserved ?? 0)

  return {
    quantity,
    reserved,
    available: Math.max(0, quantity - reserved),
  }
}

const isSimpleProduct = (product) =>
  product?.mode === 'SIMPLE' || product?.noSN === true

const isReadyProduct = (product, available) => {
  if (isSimpleProduct(product) && product?.inventoryBehavior === 'NON_STOCK') {
    return product?.active !== false && (product?.branchPrice?.length ?? 0) > 0
  }
  if (isSimpleProduct(product)) return Number(available) > 0
  return (product?.stockItems?.length ?? 0) > 0
}

module.exports = {
  calcAvailable,
  isReadyProduct,
  isSimpleProduct,
}
