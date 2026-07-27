const {
  calcAvailable,
  isReadyProduct,
} = require('../calculations/operationalStockAvailability')

const toOperationalRuntimeProduct = (p, branchId = null) => {
  if (!p) return null

  const bp = p.branchPrice?.[0] || null
  const sb = p.stockBalances?.[0] || null
  const { quantity, reserved, available } = calcAvailable(sb)
  const category = p.productType?.globalProductType?.category || null
  const productTypeName = p.productType?.name ?? '-'

  return {
    id: p.id,
    active: typeof p.active === 'boolean' ? p.active : true,
    name: p.name,
    mode: p.mode,
    inventoryBehavior: p.inventoryBehavior ?? 'TRACKED',
    saleBarcode: p.saleBarcode ?? null,
    noSN: p.noSN,
    trackSerialNumber: p.trackSerialNumber,

    templateProductId: p.templateProductId,
    isTemplateProduct: false,
    isOperationalProduct: true,

    categoryId: category?.id ?? null,
    categoryName: category?.name ?? null,
    category: category?.name ?? '-',

    productTypeId: p.productTypeId ?? null,
    productTypeName,
    productType: productTypeName,

    brandId: p.brandId ?? p.brand?.id ?? null,
    brandName: p.brand?.name ?? null,

    unitId: p.unitId ?? p.unit?.id ?? null,
    unitName: p.unit?.name ?? null,
    unit: p.unit ? { id: p.unit.id, name: p.unit.name } : null,

    costPrice: Number(bp?.costPrice ?? sb?.lastReceivedCost ?? 0),
    priceRetail: Number(bp?.priceRetail ?? 0),
    priceWholesale: Number(bp?.priceWholesale ?? 0),
    priceTechnician: Number(bp?.priceTechnician ?? 0),
    priceOnline: Number(bp?.priceOnline ?? 0),
    branchPriceActive: bp?.isActive ?? false,
    hasPrice: !!bp,

    available,
    stockBalance: sb ? { quantity, reserved, available, lastReceivedCost: sb.lastReceivedCost } : null,

    branchPrice: bp ? [bp] : [],
    ...(branchId ? { branchId } : {}),
  }
}

module.exports = { toOperationalRuntimeProduct }
