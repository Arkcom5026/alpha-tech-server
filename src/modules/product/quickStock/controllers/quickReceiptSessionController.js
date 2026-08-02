const QuickReceiptSessionService = require('../services/QuickReceiptSessionServiceSingleton')
const QuickReceiptCompleteService = require('../services/QuickReceiptCompleteServiceSingleton')
const { publishQuickReceiptTaxCandidate } = require('../services/publishQuickReceiptTaxCandidateService')

const service = new QuickReceiptSessionService()
const completeService = new QuickReceiptCompleteService()
const getActor = (req) => ({
  branchId: req.employee?.branchId || req.user?.branchId || null,
  employeeId: req.employee?.id || req.user?.employeeId || null,
  role: req.employee?.role || req.user?.role || null,
  v2Role: req.employee?.v2Role || req.user?.v2Role || null,
})
const normalizeError = (error) => {
  const databaseCode = error?.meta?.code || error?.code
  const databaseText = `${error?.message || ''} ${error?.meta?.message || ''} ${error?.meta?.cause || ''}`
  const isUniqueViolation = databaseCode === '23505' || databaseCode === 'P2002' || /unique constraint|duplicate key/i.test(databaseText)
  const isInventoryIdentity = /StockItem_barcode_ci_unique|SimpleLot_barcode_ci_unique|StockItem_serialNumber_ci_unique|barcode|serialNumber/i.test(databaseText)
  const isCheckViolation = databaseCode === '23514' || /check constraint/i.test(databaseText)
  const isTaxConstraint = /QuickReceiptSession_(tax_mode|tax_pricing|subtotal|vat_amount|total_amount)_check/i.test(databaseText)

  if (isUniqueViolation && isInventoryIdentity) {
    const conflict = new Error('Barcode หรือ Serial Number นี้มีอยู่ในระบบแล้ว')
    conflict.statusCode = 409
    conflict.code = 'INVENTORY_IDENTITY_ALREADY_EXISTS'
    conflict.details = { databaseCode }
    return conflict
  }
  if (isCheckViolation && isTaxConstraint) {
    const validation = new Error('ข้อมูลภาษีหรือยอดเอกสารไม่ถูกต้อง')
    validation.statusCode = 400
    validation.code = 'QUICK_RECEIPT_TAX_DATA_INVALID'
    validation.details = { databaseCode }
    return validation
  }
  return error
}
const sendError = (res, rawError) => {
  const error = normalizeError(rawError)
  return res.status(error?.statusCode || error?.status || 500).json({
    success: false,
    code: error?.code || 'QUICK_RECEIPT_FAILED',
    message: error?.message || 'ดำเนินการรับสินค้าด่วนไม่สำเร็จ',
    details: error?.details || error?.detail,
  })
}
const requireActor = (req, res) => {
  const actor = getActor(req)
  if (!actor.branchId || !actor.employeeId) {
    res.status(403).json({ success: false, code: 'EMPLOYEE_CONTEXT_REQUIRED', message: 'ไม่พบสาขาหรือพนักงานผู้ทำรายการ' })
    return null
  }
  return actor
}
const makeConflict = (message, code) => {
  const error = new Error(message)
  error.statusCode = 409
  error.code = code
  return error
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
exports.complete = async (req, res) => {
  try {
    const actor = requireActor(req, res); if (!actor) return
    const data = await completeService.complete(
      req.body || {},
      actor,
      req.get('X-Idempotency-Key')
    )
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
    const data = await service.addItem(req.params.id, req.body || {}, actor)
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
    const data = await service.finalize(
      req.params.id,
      actor,
      req.get('X-Idempotency-Key')
    )
    if (Number(data?.id) !== Number(req.params.id)) {
      throw makeConflict(
        'X-Idempotency-Key นี้ถูกใช้ยืนยันใบรับสินค้าอื่นแล้ว',
        'IDEMPOTENCY_KEY_CONFLICT'
      )
    }
    const taxIntake = await publishQuickReceiptTaxCandidate({
      receipt: data,
      branchId: actor.branchId,
      employeeId: actor.employeeId,
    })
    return res.json({ success: true, data: { ...data, taxIntake } })
  } catch (error) { return sendError(res, error) }
}
exports.cancel = async (req, res) => {
  try {
    const actor = requireActor(req, res); if (!actor) return
    const data = await service.cancel(req.params.id, actor.branchId, req.body?.reason)
    return res.json({ success: true, data })
  } catch (error) { return sendError(res, error) }
}
