const service = require('./discoverCatalogQualityCandidatesService')

const catalogQualityDiscoveryController = async (req, res) => {
  try {
    const result = await service.discoverCatalogQualityCandidates({
      user: req.user,
      payload: req.body || {},
    })
    return res.status(200).json(result)
  } catch (error) {
    return res.status(error.statusCode || error.status || 500).json({
      error: error.message || 'Catalog quality discovery failed',
      code: error.code || 'CATALOG_QUALITY_DISCOVERY_FAILED',
    })
  }
}

module.exports = { catalogQualityDiscoveryController }
