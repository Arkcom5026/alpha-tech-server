// src/modules/product/quickStock/controllers/quickReceiveDropdownController.js
// Workflow-specific dropdown controller for Quick Receive / QuickStock search.
// This endpoint is intentionally isolated from Product Create dropdowns.

const { prisma } = require('../../../../../lib/prisma')
const { QuickReceiveDropdownService } = require('../services/quickReceiveDropdownService')

const service = new QuickReceiveDropdownService(prisma)

const getQuickReceiveDropdowns = async (req, res) => {
  try {
    const result = await service.getDropdowns(req.query || {})
    res.set('Cache-Control', 'no-store')
    return res.json(result)
  } catch (error) {
    console.error('❌ getQuickReceiveDropdowns error:', error)
    return res.status(error?.status || error?.statusCode || 500).json({
      success: false,
      code: error?.code || 'QUICK_RECEIVE_DROPDOWNS_FAILED',
      message: error?.message || 'ไม่สามารถโหลด Dropdown สำหรับ Quick Receive ได้',
    })
  }
}

module.exports = {
  getQuickReceiveDropdowns,
}
