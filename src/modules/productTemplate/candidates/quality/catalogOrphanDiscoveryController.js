const service = require('./discoverCatalogOrphanCandidatesService')

const catalogOrphanDiscoveryController = async (req, res) => {
  try {
    const result = await service.discoverCatalogOrphanCandidates({ user: req.user, payload: req.body || {} })
    return res.status(200).json(result)
  } catch (error) {
    return res.status(error.statusCode || error.status || 500).json({
      error: error.message || 'Catalog orphan discovery failed',
      code: error.code || 'CATALOG_ORPHAN_DISCOVERY_FAILED',
    })
  }
}

module.exports = { catalogOrphanDiscoveryController }
