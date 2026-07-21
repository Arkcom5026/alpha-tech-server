const { toIsoString } = require('../utils/productTraceDate')
const { roundMoney } = require('../utils/productTraceMoney')
const {
  resolveCurrentCustody,
  resolveLifecycleStage,
} = require('../utils/productTraceStatus')

const buildProductTraceIdentity = (stockItem) => ({
  stockItemId: stockItem.id,
  barcode: stockItem.barcode,
  serialNumber: stockItem.serialNumber || null,
  batchNumber: stockItem.batchNumber || null,
  qrCodeData: stockItem.qrCodeData || null,
  status: stockItem.status,
  lifecycleStage: resolveLifecycleStage(stockItem),
  currentCustody: resolveCurrentCustody(stockItem),
  receivedAt: toIsoString(stockItem.receivedAt),
  soldAt: toIsoString(stockItem.soldAt),
  expiredAt: toIsoString(stockItem.expiredAt),
  warrantyDays: stockItem.warrantyDays ?? stockItem.product?.warrantyDays ?? null,
  locationCode: stockItem.locationCode || null,
  color: stockItem.color || null,
  tag: stockItem.tag || null,
  source: stockItem.source || null,
  remark: stockItem.remark || null,
  recordedCost: roundMoney(stockItem.costPrice),
  product: {
    id: stockItem.product?.id || null,
    name: stockItem.product?.name || '-',
    mode: stockItem.product?.mode || null,
    trackSerialNumber: Boolean(stockItem.product?.trackSerialNumber),
    noSN: Boolean(stockItem.product?.noSN),
    brand: stockItem.product?.brand
      ? { id: stockItem.product.brand.id, name: stockItem.product.brand.name }
      : null,
    productType: stockItem.product?.productType
      ? {
          id: stockItem.product.productType.id,
          name: stockItem.product.productType.name,
          globalName: stockItem.product.productType.globalProductType?.name || null,
        }
      : null,
    unit: stockItem.product?.unit
      ? { id: stockItem.product.unit.id, name: stockItem.product.unit.name }
      : null,
    images: (stockItem.product?.productImages || []).map((image) => ({
      id: image.id,
      url: image.secure_url || image.url,
      caption: image.caption || null,
      isCover: Boolean(image.isCover),
    })),
  },
  branch: stockItem.branch
    ? {
        id: stockItem.branch.id,
        name: stockItem.branch.name,
        branchCode: stockItem.branch.branchCode || null,
        slug: stockItem.branch.slug || null,
      }
    : null,
})

module.exports = {
  buildProductTraceIdentity,
}
