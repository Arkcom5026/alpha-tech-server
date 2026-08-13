const service = require('./createCatalogQualityCandidateService')

const createCatalogQualityCandidate = async (req, res) => {
  try {
    const result = await service.createCatalogQualityCandidate({
      user: req.user,
      payload: req.body || {},
    })
    return res.status(result.created ? 201 : 200).json(result)
  } catch (error) {
    return res.status(error.statusCode || error.status || 500).json({
      error: error.message || 'Catalog quality candidate creation failed',
      code: error.code || 'CATALOG_QUALITY_CANDIDATE_CREATE_FAILED',
    })
  }
}

module.exports = {
  createCatalogQualityCandidate,
}
