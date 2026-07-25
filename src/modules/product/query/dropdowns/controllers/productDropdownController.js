// src/modules/product/query/dropdowns/controllers/productDropdownController.js

const productDropdownService = require('../services/productDropdownService')

const getDropdowns = async (req, res) => {
  try {
    const includeInactive =
      String(req.query?.includeInactive ?? 'false').toLowerCase() === 'true'

    const result = await productDropdownService.getDropdowns({
      branchId: req.user?.branchId || req.query?.branchId,
      includeInactive,
    })

    return res.json(result)
  } catch (error) {
    if (error?.status) {
      return res.status(error.status).json({
        error: error.code || error.message,
        ...(error.message && error.message !== error.code ? { message: error.message } : {}),
      })
    }

    console.error('❌ productDropdown runtime error:', error)
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' })
  }
}

module.exports = { getDropdowns }
