const service = require('./auditProductTemplateDiscoveryService')

const auditProductTemplateDiscovery = async (req, res) => {
  try {
    const result = await service.auditDiscovery({ user: req.user, query: req.query })
    return res.status(200).json(result)
  } catch (error) {
    console.error('[auditProductTemplateDiscoveryController] error:', error)
    return res.status(error.status || 500).json({
      error: error.message || 'Product Template discovery audit failed',
      code: error.code || 'PRODUCT_TEMPLATE_DISCOVERY_AUDIT_FAILED',
    })
  }
}

module.exports = {
  auditProductTemplateDiscovery,
}
