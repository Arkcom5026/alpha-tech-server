const service = require('./getProductTemplateCandidateService')

const getProductTemplateCandidate = async (req, res) => {
  try {
    const data = await service.getCandidate({
      user: req.user,
      candidateId: req.params?.id,
    })
    return res.status(200).json({ data })
  } catch (error) {
    const statusCode = error?.statusCode || 500
    if (statusCode >= 500) {
      console.error('[getProductTemplateCandidateController] error:', error)
    }
    return res.status(statusCode).json({
      error: error?.message || 'Failed to load product template candidate',
      code: error?.code || 'PRODUCT_TEMPLATE_CANDIDATE_DETAIL_FAILED',
    })
  }
}

module.exports = { getProductTemplateCandidate }
