'use strict'

const service = require('../services/partnerStoreCapabilityService')

const getActorBranchId = (req) => req.employee?.branchId || req.user?.branchId || null

const requireBranch = (req, res) => {
  const branchId = Number(getActorBranchId(req))
  if (!Number.isInteger(branchId) || branchId <= 0) {
    res.status(403).json({
      success: false,
      code: 'EMPLOYEE_BRANCH_CONTEXT_REQUIRED',
      message: 'ไม่พบสาขาของพนักงานผู้ทำรายการ',
    })
    return null
  }
  return branchId
}

const sendError = (res, error) =>
  res.status(error?.statusCode || error?.status || 500).json({
    success: false,
    code: error?.code || 'PARTNER_STORE_CAPABILITY_FAILED',
    message: error?.message || 'ดำเนินการตั้งค่าร้านไม่สำเร็จ',
    details: error?.details,
  })

exports.getCurrentBranchCapability = async (req, res) => {
  try {
    const branchId = requireBranch(req, res)
    if (!branchId) return
    const data = await service.getForBranch(branchId)
    return res.json({ success: true, data })
  } catch (error) {
    return sendError(res, error)
  }
}

exports.saveCurrentBranchCapability = async (req, res) => {
  try {
    const branchId = requireBranch(req, res)
    if (!branchId) return
    const data = await service.saveForBranch(branchId, req.body || {})
    return res.json({ success: true, data })
  } catch (error) {
    return sendError(res, error)
  }
}
