const service = require('./listProductTemplateCandidatesService')

const listProductTemplateCandidates = async (req, res) => {
  try {
    const data = await service.listCandidates({
      user: req.user,
      query: req.query || {},
    })
    return res.status(200).json({ data })
  } catch (error) {
    const statusCode = error?.statusCode || 500
    if (statusCode >= 500) {
      console.error('[listProductTemplateCandidatesController] error:', error)
    }
    return res.status(statusCode).json({
      error: error?.message || 'Failed to list product template candidates',
      code: error?.code || 'PRODUCT_TEMPLATE_CANDIDATE_LIST_FAILED',
    })
  }
}

module.exports = { listProductTemplateCandidates }
