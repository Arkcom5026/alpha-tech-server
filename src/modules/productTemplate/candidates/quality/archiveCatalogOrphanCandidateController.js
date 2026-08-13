const service = require('./archiveCatalogOrphanCandidateService')

const archiveCatalogOrphanCandidateController = async (req, res) => {
  try {
    const result = await service.archiveCatalogOrphanCandidate({
      user: req.user,
      candidateId: req.params.id,
      payload: req.body || {},
    })

    return res.status(200).json(result)
  } catch (error) {
    return res.status(error.statusCode || error.status || 500).json({
      error: error.message || 'Catalog Orphan archive failed',
      code: error.code || 'CATALOG_ORPHAN_ARCHIVE_FAILED',
    })
  }
}

module.exports = {
  archiveCatalogOrphanCandidateController,
}
