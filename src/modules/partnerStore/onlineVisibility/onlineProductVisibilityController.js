'use strict'

const service = require('./onlineProductVisibilityService')

const getActorBranchId = (req) => req.employee?.branchId || req.user?.branchId || null

const getCurrentBranchAudit = async (req, res) => {
  try {
    const branchId = Number(getActorBranchId(req))
    if (!Number.isInteger(branchId) || branchId <= 0) {
      return res.status(403).json({
        success: false,
        code: 'EMPLOYEE_BRANCH_CONTEXT_REQUIRED',
        message: 'ไม่พบร้านของพนักงานผู้ทำรายการ',
      })
    }

    const data = await service.auditForBranch(branchId)
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(error?.statusCode || 500).json({
      success: false,
      code: error?.code || 'ONLINE_PRODUCT_VISIBILITY_AUDIT_FAILED',
      message: error?.message || 'ตรวจสอบสถานะสินค้าออนไลน์ไม่สำเร็จ',
    })
  }
}

module.exports = Object.freeze({ getCurrentBranchAudit })
