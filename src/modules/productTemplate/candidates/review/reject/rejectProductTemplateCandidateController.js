const service = require('./rejectProductTemplateCandidateService')

const rejectProductTemplateCandidate = async (req, res) => {
  try {
    const data = await service.rejectCandidate({
      user: req.user,
      candidateId: req.params?.id,
      payload: req.body || {},
    })
    return res.status(200).json({ data })
  } catch (error) {
    const statusCode = error?.statusCode || 500
    if (statusCode >= 500) {
      console.error('[rejectProductTemplateCandidateController] error:', error)
    }
    return res.status(statusCode).json({
      error: error?.message || 'Failed to reject product template candidate',
      code: error?.code || 'PRODUCT_TEMPLATE_CANDIDATE_REJECT_FAILED',
    })
  }
}

module.exports = { rejectProductTemplateCandidate }
