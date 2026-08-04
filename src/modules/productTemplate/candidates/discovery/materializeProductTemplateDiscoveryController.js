const {
  materializeDiscovery,
} = require('./materializeProductTemplateDiscoveryService')

const materializeProductTemplateDiscovery = async (req, res) => {
  try {
    const result = await materializeDiscovery({
      user: req.user,
      payload: req.body || {},
    })
    return res.status(200).json({ data: result })
  } catch (error) {
    console.error('[materializeProductTemplateDiscoveryController] error:', error)
    return res.status(error.statusCode || error.status || 500).json({
      error: error.message,
      code: error.code || 'PRODUCT_TEMPLATE_DISCOVERY_MATERIALIZATION_FAILED',
    })
  }
}

module.exports = {
  materializeProductTemplateDiscovery,
}
