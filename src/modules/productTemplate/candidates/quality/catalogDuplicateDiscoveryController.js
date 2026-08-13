const discoveryService = require('./discoverCatalogDuplicateCandidatesService')

async function catalogDuplicateDiscoveryController(req, res) {
  try {
    const result = await discoveryService.discoverCatalogDuplicateCandidates({ user: req.user, payload: req.body || {} })
    return res.status(200).json(result)
  } catch (error) {
    return res.status(error.statusCode || error.status || 500).json({
      error: error.message || 'Catalog quality request failed',
      code: error.code || 'CATALOG_QUALITY_REQUEST_FAILED',
    })
  }
}

module.exports = { catalogDuplicateDiscoveryController }
