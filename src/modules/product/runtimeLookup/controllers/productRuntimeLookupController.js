const { findOperationalProductByTemplateId } = require('../services/productRuntimeLookupService')

const getOperationalProductByTemplateId = async (req, res) => {
  try {
    const result = await findOperationalProductByTemplateId({
      branchId: req.user?.branchId,
      templateProductId: req.params.templateProductId || req.query.templateProductId,
    })
    return res.json(result)
  } catch (error) {
    if (error?.code === 'BRANCH_ID_MISSING') return res.status(401).json({ success: false, error: 'BRANCH_ID_MISSING' })
    if (error?.code === 'TEMPLATE_PRODUCT_ID_MISSING') {
      return res.status(400).json({ success: false, error: 'TEMPLATE_PRODUCT_ID_MISSING', message: 'ไม่พบ templateProductId' })
    }
    console.error('❌ getOperationalProductByTemplateId error:', error)
    return res.status(500).json({ success: false, error: 'RUNTIME_PRODUCT_LOOKUP_FAILED', message: 'ตรวจสอบ Operational Product ไม่สำเร็จ' })
  }
}

module.exports = { getOperationalProductByTemplateId }
