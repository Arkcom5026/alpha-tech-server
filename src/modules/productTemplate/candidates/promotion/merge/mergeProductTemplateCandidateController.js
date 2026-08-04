const service = require('./mergeProductTemplateCandidateService')

const mergeProductTemplateCandidate = async (req, res) => {
  try {
    const data = await service.mergeCandidate({
      user: req.user,
      candidateId: req.params?.id,
      payload: req.body || {},
    })

    return res.json({ data })
  } catch (error) {
    const statusCode = error?.statusCode || 500
    if (statusCode >= 500) {
      console.error('[mergeProductTemplateCandidateController] error:', error)
    }
    return res.status(statusCode).json({
      error: error?.message || 'Failed to merge product template candidate',
      code: error?.code || 'PRODUCT_TEMPLATE_CANDIDATE_MERGE_FAILED',
    })
  }
}

module.exports = { mergeProductTemplateCandidate }
