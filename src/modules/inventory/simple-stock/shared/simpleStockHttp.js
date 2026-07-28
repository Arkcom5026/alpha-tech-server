'use strict'

const buildSimpleStockContext = (req) => ({
  userId: req.user?.id || null,
  role: req.user?.role || null,
  branchId: req.user?.branchId || null,
  idempotencyKey: req.headers['x-idempotency-key'] || null,
  ts: new Date().toISOString(),
})

const toNumber = (value) =>
  value === undefined || value === null || value === '' ? Number.NaN : Number(value)

const sendSimpleStockError = (res, status, message, extra) => {
  const payload = { ok: false, message }
  if (extra && typeof extra === 'object') Object.assign(payload, extra)
  return res.status(status).json(payload)
}

const requireSimpleStockBranch = (req, res) => {
  const branchId = req.user?.branchId
  if (branchId) return branchId

  sendSimpleStockError(res, 401, 'Unauthorized (missing branchId)', {
    context: buildSimpleStockContext(req),
  })
  return null
}

module.exports = {
  buildSimpleStockContext,
  requireSimpleStockBranch,
  sendSimpleStockError,
  toNumber,
}
