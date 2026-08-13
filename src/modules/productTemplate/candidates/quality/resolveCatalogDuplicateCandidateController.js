const service = require('./resolveCatalogDuplicateCandidateService')

const resolveCatalogDuplicateCandidateController = async (req, res) => {
  try {
    const result = await service.resolveCatalogDuplicateCandidate({
      user: req.user,
      candidateId: req.params.id,
      payload: req.body || {},
    })
    return res.status(200).json(result)
  } catch (error) {
    return res.status(error.statusCode || error.status || 500).json({
      error: error.message || 'Catalog duplicate resolution failed',
      code: error.code || 'CATALOG_DUPLICATE_RESOLUTION_FAILED',
    })
  }
}

module.exports = { resolveCatalogDuplicateCandidateController }
