const service = require('./promoteProductTemplateCandidateService')

const promoteProductTemplateCandidate = async (req, res) => {
  try {
    const data = await service.promoteCandidate({
      user: req.user,
      candidateId: req.params?.id,
      payload: req.body || {},
    })

    return res.status(200).json({ data })
  } catch (error) {
    const statusCode = error?.statusCode || 500
    if (statusCode >= 500) {
      console.error('[promoteProductTemplateCandidateController] error:', error)
    }
    return res.status(statusCode).json({
      error: error?.message || 'Failed to promote product template candidate',
      code: error?.code || 'PRODUCT_TEMPLATE_CANDIDATE_PROMOTE_FAILED',
    })
  }
}

module.exports = { promoteProductTemplateCandidate }
