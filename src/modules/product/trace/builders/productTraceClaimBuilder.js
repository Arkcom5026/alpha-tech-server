const { toIsoString } = require('../utils/productTraceDate')

const buildProductTraceClaims = (stockItem) =>
  (stockItem.warrantyClaims || []).map((claim) => ({
    id: claim.id,
    claimNo: claim.claimNo,
    status: claim.status,
    reason: claim.reason,
    createdAt: toIsoString(claim.createdAt),
    updatedAt: toIsoString(claim.updatedAt),
  }))

module.exports = {
  buildProductTraceClaims,
}
