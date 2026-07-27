const QuickReceiptSessionService = require('../services/QuickReceiptSessionServiceSingleton')

const service = new QuickReceiptSessionService()
const getActor = (req) => ({
  branchId: req.employee?.branchId || req.user?.branchId || null,
  employeeId: req.employee?.id || req.user?.employeeId || null,
})
const sendError = (res, error) => res.status(error?.statusCode || error?.status || 500).json({
  success: false,
  code: error?.code || 'QUICK_RECEIPT_FAILED',
  message: error?.message || 'ดำเนินการรับสินค้าด่วนไม่สำเร็จ',
  details: error?.details,
})
const requireActor = (req, res) => {
  const actor = getActor(req)
  if (!actor.branchId || !actor.employeeId) {
    res.status(403).json({ success: false, code: 'EMPLOYEE_CONTEXT_REQUIRED', message: 'ไม่พบสาขาหรือพนักงานผู้ทำรายการ' })
    return null
  }
  return actor
}

exports.list = async (req, res) => {
  try {
    const actor = requireActor(req, res); if (!actor) return
    const data = await service.listReceipts({ branchId: actor.branchId, ...req.query })
    return res.json({ success: true, data })
  } catch (error) { return sendError(res, error) }
}
exports.detail = async (req, res) => {
  try {
    const actor = requireActor(req, res); if (!actor) return
    const data = await service.getReceipt(req.params.id, actor.branchId)
    return res.json({ success: true, data })
  } catch (error) { return sendError(res, error) }
}
exports.create = async (req, res) => {
  try {
    const actor = requireActor(req, res); if (!actor) return
    const data = await service.createDraft(req.body || {}, actor.branchId, actor.employeeId)
    return res.status(201).json({ success: true, data })
  } catch (error) { return sendError(res, error) }
}
exports.update = async (req, res) => {
  try {
    const actor = requireActor(req, res); if (!actor) return
    const data = await service.updateDraft(req.params.id, req.body || {}, actor.branchId)
    return res.json({ success: true, data })
  } catch (error) { return sendError(res, error) }
}
exports.addItem = async (req, res) => {
  try {
    const actor = requireActor(req, res); if (!actor) return
    const data = await service.addItem(req.params.id, req.body || {}, actor.branchId)
    return res.status(201).json({ success: true, data })
  } catch (error) { return sendError(res, error) }
}
exports.deleteItem = async (req, res) => {
  try {
    const actor = requireActor(req, res); if (!actor) return
    const data = await service.deleteItem(req.params.id, req.params.itemId, actor.branchId)
    return res.json({ success: true, data })
  } catch (error) { return sendError(res, error) }
}
exports.finalize = async (req, res) => {
  try {
    const actor = requireActor(req, res); if (!actor) return
    const data = await service.finalize(req.params.id, actor.branchId, actor.employeeId, req.get('X-Idempotency-Key'))
    return res.json({ success: true, data })
  } catch (error) { return sendError(res, error) }
}
exports.cancel = async (req, res) => {
  try {
    const actor = requireActor(req, res); if (!actor) return
    const data = await service.cancel(req.params.id, actor.branchId, req.body?.reason)
    return res.json({ success: true, data })
  } catch (error) { return sendError(res, error) }
}
