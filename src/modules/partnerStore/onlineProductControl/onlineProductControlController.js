'use strict'

const service = require('./onlineProductControlService')

const actorBranchId = (req) => Number(req.employee?.branchId || req.user?.branchId)

const updateMarketplacePrice = async (req, res) => {
  try {
    const data = await service.updateMarketplacePrice({
      branchId: actorBranchId(req),
      productId: Number(req.params.productId),
      input: req.body || {},
    })
    return res.json({ success: true, data })
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || 'MARKETPLACE_PRODUCT_CONTROL_FAILED',
      message: error.message || 'บันทึกการตั้งค่าสินค้าออนไลน์ไม่สำเร็จ',
    })
  }
}

module.exports = Object.freeze({ updateMarketplacePrice })
