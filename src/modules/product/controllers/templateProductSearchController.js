// src/modules/product/controllers/templateProductSearchController.js
// Controller สำหรับค้นหา Product Template จาก T01

const { prisma } = require('../../../../lib/prisma')
const {
  TemplateProductSearchService,
} = require('../services/templateProductSearchService')

const service = new TemplateProductSearchService(prisma)

const searchTemplateProducts = async (req, res) => {
  try {
    const result = await service.searchTemplateProducts(req.query || {})
    return res.status(200).json({
      success: true,
      data: result,
      items: result,
    })
  } catch (error) {
    console.error('❌ searchTemplateProducts error:', error)

    const statusCode = error?.statusCode || error?.status || 500
    return res.status(statusCode).json({
      success: false,
      message: error?.message || 'ไม่สามารถค้นหา Product Template ได้',
      code: error?.code || 'TEMPLATE_PRODUCT_SEARCH_FAILED',
    })
  }
}

module.exports = {
  searchTemplateProducts,
}
