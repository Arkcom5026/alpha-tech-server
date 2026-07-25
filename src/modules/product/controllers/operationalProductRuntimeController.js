const {
  createLocalOperationalProduct: createLocalOperationalProductService,
  createOperationalProductFromTemplate: createOperationalProductFromTemplateService,
  findOperationalProductById,
  findOperationalProductByTemplateId,
  findOperationalProductsForPOS,
  findOperationalProductsForOnline,
  findOperationalProductOnlineById,
  getReadyToSell: getReadyToSellService,
  getReadyToSellStructuredDetails: getReadyToSellStructuredDetailsService,
} = require('../services/operationalProductRuntimeService')

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

const createLocalOperationalProduct = async (req, res) => {
  try {
    const result = await createLocalOperationalProductService({
      branchId: req.user?.branchId,
      data: req.body || {},
    })

    return res.status(201).json(result)
  } catch (error) {
    console.error('createLocalOperationalProduct error:', error)
    const status = error?.status || error?.statusCode || 500
    return res.status(status).json({
      success: false,
      error: error?.code || error?.message || 'CREATE_LOCAL_OPERATIONAL_PRODUCT_FAILED',
    })
  }
}

const createOperationalProductFromTemplate = async (req, res) => {
  try {
    const result = await createOperationalProductFromTemplateService({
      branchId: req.user?.branchId,
      templateProductId: req.body?.templateProductId,
    })

    const status = result.statusCode || (result.created ? 201 : 200)
    const { statusCode, ...payload } = result

    return res.status(status).json(payload)
  } catch (error) {
    console.error('createOperationalProductFromTemplate error:', error)

    const code = error?.code || error?.message
    if (
      code === 'BRANCH_ID_MISSING' ||
      code === 'TEMPLATE_PRODUCT_ID_MISSING' ||
      code === 'TEMPLATE_BRANCH_NOT_FOUND' ||
      code === 'TEMPLATE_PRODUCT_NOT_FOUND' ||
      code === 'PRODUCT_TYPE_NOT_FOUND_IN_BRANCH'
    ) {
      return res.status(error?.status || error?.statusCode || 400).json({
        success: false,
        error: code,
      })
    }

    return res.status(500).json({
      success: false,
      error: 'CREATE_OPERATIONAL_PRODUCT_FROM_TEMPLATE_FAILED',
    })
  }
}

const getProductsForPos = async (req, res) => {
  try {
    const result = await findOperationalProductsForPOS({
      branchId: req.user?.branchId,
      search: req.query.search || req.query.searchText || '',
      take: req.query.take,
      page: req.query.page,
      productTypeId: req.query.productTypeId,
      brandId: req.query.brandId,
      readyOnly: req.query.readyOnly,
      hasPrice: req.query.hasPrice,
      activeOnly: req.query.activeOnly,
      includeInactive: req.query.includeInactive,
      mode: req.query.mode,
      simpleOnly: req.query.simpleOnly,
    })

    return res.json(result)
  } catch (error) {
    if (error?.code === 'unauthorized') return res.status(401).json({ error: 'unauthorized' })

    console.error('❌ getProductsForPos error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

const getOperationalProductByTemplateId = async (req, res) => {
  try {
    const result = await findOperationalProductByTemplateId({
      branchId: req.user?.branchId,
      templateProductId: req.params.templateProductId || req.query.templateProductId,
    })
    return res.json(result)
  } catch (error) {
    if (error?.code === 'BRANCH_ID_MISSING') {
      return res.status(401).json({ success: false, error: 'BRANCH_ID_MISSING' })
    }
    if (error?.code === 'TEMPLATE_PRODUCT_ID_MISSING') {
      return res.status(400).json({
        success: false,
        error: 'TEMPLATE_PRODUCT_ID_MISSING',
        message: 'ไม่พบ templateProductId',
      })
    }
    console.error('❌ getOperationalProductByTemplateId error:', error)
    return res.status(500).json({
      success: false,
      error: 'RUNTIME_PRODUCT_LOOKUP_FAILED',
      message: 'ตรวจสอบ Operational Product ไม่สำเร็จ',
    })
  }
}

const getProductPosById = async (req, res) => {
  try {
    const result = await findOperationalProductById({
      branchId: req.user?.branchId,
      productId: req.params.id,
    })

    return res.json(result)
  } catch (error) {
    if (error?.code === 'unauthorized') return res.status(401).json({ error: 'unauthorized' })
    if (error?.code === 'INVALID_ID') return res.status(400).json({ error: 'INVALID_ID' })
    if (error?.code === 'NOT_FOUND') return res.status(404).json({ error: 'NOT_FOUND' })

    console.error('❌ getProductPosById error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

const getProductsForOnline = async (req, res) => {
  try {
    const result = await findOperationalProductsForOnline({
      branchId: Number(req.user?.branchId) || toInt(req.query.branchId),
      search: req.query.search || req.query.searchText || '',
      take: req.query.take,
      size: req.query.size,
      page: req.query.page,
      productTypeId: req.query.productTypeId,
      brandId: req.query.brandId,
      readyOnly: req.query.readyOnly,
      hasPrice: req.query.hasPrice,
      mode: req.query.mode,
      simpleOnly: req.query.simpleOnly,
    })

    return res.json(result)
  } catch (error) {
    if (error?.code === 'BRANCH_REQUIRED') return res.status(400).json({ error: 'BRANCH_REQUIRED' })

    console.error('❌ getProductsForOnline error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

const getProductOnlineById = async (req, res) => {
  try {
    const result = await findOperationalProductOnlineById({
      branchId: toInt(req.query.branchId) ?? Number(req.user?.branchId),
      productId: req.params.id,
    })

    return res.json(result)
  } catch (error) {
    if (error?.code === 'BRANCH_REQUIRED') return res.status(400).json({ error: 'BRANCH_REQUIRED' })
    if (error?.code === 'INVALID_ID') return res.status(400).json({ error: 'INVALID_ID' })
    if (error?.code === 'NOT_FOUND') return res.status(404).json({ error: 'NOT_FOUND' })

    console.error('❌ getProductOnlineById error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

const getReadyToSell = async (req, res) => {
  try {
    const result = await getReadyToSellService({
      branchId: req.user?.branchId,
      q: req.query?.q,
      search: req.query?.search,
      searchText: req.query?.searchText,
      mode: req.query?.mode,
      page: req.query?.page,
      pageSize: req.query?.pageSize,
    })

    return res.json(result)
  } catch (error) {
    if (error?.code === 'unauthorized') return res.status(401).json({ error: 'unauthorized' })

    console.error('❌ getReadyToSell error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

const getReadyToSellStructuredDetails = async (req, res) => {
  try {
    const result = await getReadyToSellStructuredDetailsService({
      branchId: req.user?.branchId,
      productId: req.params.productId,
      q: req.query?.q || '',
    })

    return res.json(result)
  } catch (error) {
    if (error?.code === 'unauthorized') return res.status(401).json({ error: 'unauthorized' })
    if (error?.code === 'INVALID_PRODUCT_ID') return res.status(400).json({ error: 'invalid productId' })

    console.error('❌ getReadyToSellStructuredDetails error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = {
  createLocalOperationalProduct,
  createOperationalProductFromTemplate,
  getProductsForPos,
  getOperationalProductByTemplateId,
  getProductPosById,
  getProductsForOnline,
  getProductOnlineById,
  getReadyToSell,
  getReadyToSellStructuredDetails,
}
