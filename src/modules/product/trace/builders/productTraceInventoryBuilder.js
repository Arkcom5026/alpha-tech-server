const { toIsoString } = require('../utils/productTraceDate')

const buildProductTraceInventory = (stockItem) => ({
  branch: stockItem.branch
    ? { id: stockItem.branch.id, name: stockItem.branch.name }
    : null,
  status: stockItem.status,
  locationCode: stockItem.locationCode || null,
  source: stockItem.source || null,
  checkedBy: stockItem.checkedBy || null,
  scannedAt: toIsoString(stockItem.scannedAt),
  scannedBy: stockItem.scannedBy
    ? { id: stockItem.scannedBy.id, name: stockItem.scannedBy.name || '-' }
    : null,
  createdAt: toIsoString(stockItem.createdAt),
  updatedAt: toIsoString(stockItem.updatedAt),
})

module.exports = {
  buildProductTraceInventory,
}
