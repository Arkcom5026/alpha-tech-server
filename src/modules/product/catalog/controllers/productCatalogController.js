const productCatalogService = require('../services/productCatalogService')

const getAllProducts = async (req, res) => {
  try {
    const products = await productCatalogService.listOperationalProducts({
      branchId: req.user?.branchId,
      queryBranchId: req.query?.branchId,
      search: req.query?.search,
      take: req.query?.take,
      page: req.query?.page,
      categoryId: req.query?.categoryId,
      productTypeId: req.query?.productTypeId,
      brandId: req.query?.brandId,
    })

    return res.json(products)
  } catch (error) {
    if (error?.code === 'BRANCH_REQUIRED') {
      return res.status(400).json({
        error: 'BRANCH_REQUIRED',
        message: error.message || 'ไม่พบข้อมูลสาขา',
      })
    }

    console.error('❌ getAllProducts error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = {
  getAllProducts,
}
