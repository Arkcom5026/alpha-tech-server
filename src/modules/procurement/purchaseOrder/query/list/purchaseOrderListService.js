const { findPurchaseOrders } = require('./purchaseOrderListRepository')

const parseStatusCsv = (value) => {
  if (!value) return []
  const list = Array.isArray(value) ? value : String(value).split(',')
  return list.map((status) => String(status).trim().toUpperCase()).filter(Boolean)
}

const listPurchaseOrders = async ({ branchId, page, pageSize, search, status }) => {
  const normalizedBranchId = Number(branchId)
  if (!normalizedBranchId) {
    const error = new Error('Unauthorized: Missing branchId')
    error.code = 'MISSING_BRANCH_ID'
    error.statusCode = 401
    throw error
  }

  const normalizedPage = Math.max(1, Number(page) || 1)
  const normalizedPageSize = Math.min(200, Math.max(1, Number(pageSize) || 50))
  const normalizedSearch = String(search || '').trim()
  const statuses = parseStatusCsv(status)

  return findPurchaseOrders({
    branchId: normalizedBranchId,
    statuses,
    search: normalizedSearch,
    skip: (normalizedPage - 1) * normalizedPageSize,
    take: normalizedPageSize,
  })
}

module.exports = {
  listPurchaseOrders,
  parseStatusCsv,
}
