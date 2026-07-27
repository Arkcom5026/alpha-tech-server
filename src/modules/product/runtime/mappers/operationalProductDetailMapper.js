const {
  calcAvailable,
  isReadyProduct,
} = require('../calculations/operationalStockAvailability')

const toOperationalProductDetail = (p) => {
  if (!p) return null

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

  const mode = p.mode ?? (p.noSN ? 'SIMPLE' : 'STRUCTURED')
  const catName = p.productType?.globalProductType?.category?.name ?? '-'
  const typeName = p.productType?.name ?? '-'

  const branchPriceObj = {
    costPrice: Number(bp?.costPrice ?? 0),
    priceWholesale: Number(bp?.priceWholesale ?? 0),
    priceTechnician: Number(bp?.priceTechnician ?? 0),
    priceRetail: Number(bp?.priceRetail ?? 0),
    priceOnline: Number(bp?.priceOnline ?? 0),
  }

  return {
    id: p.id,
    name: p.name,
    spec: null,
    mode,
    inventoryBehavior: p.inventoryBehavior ?? 'TRACKED',
    saleBarcode: p.saleBarcode ?? null,
    noSN: p.noSN,
    trackSerialNumber: p.trackSerialNumber,
    unitId: p.unitId ?? p.unit?.id ?? null,
    unitName: p.unit?.name ?? null,
    unit: p.unit ? { id: p.unit.id, name: p.unit.name } : null,
    categoryId: p.productType?.globalProductType?.categoryId ?? null,
    productTypeId: p.productTypeId ?? null,
    productProfileId: null,
    templateId: null,
    productTemplateId: null,
    categoryName: catName,
    productTypeName: typeName,
    productProfileName: '-',
    productTemplateName: '-',
    brandId: p.brandId ?? p.brand?.id ?? null,
    brandName: p.brand?.name ?? null,
    images: (p.productImages || [])
      .map((im) => ({
        id: im.id,
        url: im.secure_url || im.url,
        caption: im.caption ?? '',
        isCover: Boolean(im.isCover),
      }))
      .filter((im) => !!im.url),
    costPrice: branchPriceObj.costPrice,
    priceWholesale: branchPriceObj.priceWholesale,
    priceTechnician: branchPriceObj.priceTechnician,
    priceRetail: branchPriceObj.priceRetail,
    priceOnline: branchPriceObj.priceOnline,
    branchPriceActive: bp?.isActive ?? true,
    available,
    isReady,
    lastCost,
    branchPrice: branchPriceObj,
  }
}

module.exports = { toOperationalProductDetail }
