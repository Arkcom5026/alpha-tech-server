const {
  calcAvailable,
  isReadyProduct,
} = require('../calculations/operationalStockAvailability')

const toOperationalProductOnlineSearchItem = (p) => {
  const bp = p.branchPrice?.[0]
  const sb = p.stockBalances?.[0]
  const { available } = calcAvailable(sb)
  const isReady = isReadyProduct(p, available)
  const imageUrl = p.productImages?.[0]?.secure_url || p.productImages?.[0]?.url || null

  return {
    id: p.id,
    name: p.name,
    mode: p.mode,
    inventoryBehavior: p.inventoryBehavior ?? 'TRACKED',
    saleBarcode: p.saleBarcode ?? null,
    categoryId: p.productType?.globalProductType?.category?.id ?? null,
    productTypeId: p.productTypeId ?? null,
    imageUrl,
    priceOnline: Number(bp?.priceOnline ?? 0),
    priceOnlineEffective: bp && bp.isActive === false ? null : Number(bp?.priceOnline ?? 0),
    readyPickupAtBranch: isReady,
    isReady,
    category: p.productType?.globalProductType?.category?.name,
    productType: p.productType?.name,
    brandId: p.brandId ?? p.brand?.id ?? null,
    brandName: p.brand?.name ?? null,
    unitId: p.unitId ?? p.unit?.id ?? null,
    unitName: p.unit?.name ?? null,
    unit: p.unit ? { id: p.unit.id, name: p.unit.name } : null,
    hasPrice: !!bp,
    branchPriceActive: bp?.isActive ?? true,
  }
}

const toOperationalOnlineProductDetail = (p) => {
  if (!p) return null

  const bp = p.branchPrice?.[0]
  const sb = p.stockBalances?.[0]
  const { available } = calcAvailable(sb)
  const isReady = isReadyProduct(p, available)
  const imageUrl = p.productImages?.[0]?.secure_url || p.productImages?.[0]?.url || null

  return {
    id: p.id,
    name: p.name,
    mode: p.mode ?? (p.noSN ? 'SIMPLE' : 'STRUCTURED'),
    inventoryBehavior: p.inventoryBehavior ?? 'TRACKED',
    saleBarcode: p.saleBarcode ?? null,
    brandId: p.brandId ?? p.brand?.id ?? null,
    brandName: p.brand?.name ?? null,
    unitId: p.unitId ?? p.unit?.id ?? null,
    unitName: p.unit?.name ?? null,
    unit: p.unit ? { id: p.unit.id, name: p.unit.name } : null,
    imageUrl,
    priceOnline: Number(bp?.priceOnline ?? 0),
    priceOnlineEffective: bp && bp.isActive === false ? null : Number(bp?.priceOnline ?? 0),
    readyPickupAtBranch: isReady,
    isReady,
    hasPrice: !!bp,
    branchPriceActive: bp?.isActive ?? true,
  }
}

module.exports = {
  toOperationalOnlineProductDetail,
  toOperationalProductOnlineSearchItem,
}
