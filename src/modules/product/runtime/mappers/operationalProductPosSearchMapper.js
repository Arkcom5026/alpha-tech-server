const {
  calcAvailable,
  isReadyProduct,
} = require('../calculations/operationalStockAvailability')

const toOperationalProductPosSearchItem = (p) => {
  const bp = p.branchPrice?.[0]
  const sb = p.stockBalances?.[0]
  const { available } = calcAvailable(sb)
  const isReady = isReadyProduct(p, available)

  const lastCost =
    sb?.lastReceivedCost != null
      ? Number(sb.lastReceivedCost)
      : bp?.costPrice != null
        ? Number(bp.costPrice)
        : null

  const catName = p.productType?.globalProductType?.category?.name ?? '-'
  const typeName = p.productType?.name ?? '-'

  return {
    id: p.id,
    templateProductId: p.templateProductId ?? null,
    active: typeof p.active === 'boolean' ? p.active : true,
    name: p.name,
    mode: p.mode,
    inventoryBehavior: p.inventoryBehavior ?? 'TRACKED',
    saleBarcode: p.saleBarcode ?? null,
    categoryId: p.productType?.globalProductType?.category?.id ?? null,
    productTypeId: p.productTypeId ?? null,
    category: catName,
    productType: typeName,
    brandId: p.brandId ?? p.brand?.id ?? null,
    brandName: p.brand?.name ?? null,
    unitId: p.unitId ?? p.unit?.id ?? null,
    unitName: p.unit?.name ?? null,
    unit: p.unit ? { id: p.unit.id, name: p.unit.name } : null,
    noSN: p.noSN,
    trackSerialNumber: p.trackSerialNumber,
    priceRetail: Number(bp?.priceRetail ?? 0),
    priceWholesale: Number(bp?.priceWholesale ?? 0),
    priceTechnician: Number(bp?.priceTechnician ?? 0),
    priceOnline: Number(bp?.priceOnline ?? 0),
    branchPriceActive: bp?.isActive ?? true,
    available,
    isReady,
    lastCost,
    costPrice: lastCost,
    hasPrice: !!bp,
  }
}

module.exports = { toOperationalProductPosSearchItem }
