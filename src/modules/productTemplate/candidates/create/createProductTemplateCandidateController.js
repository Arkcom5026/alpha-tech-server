const service = require('./createProductTemplateCandidateService')

const createProductTemplateCandidate = async (req, res) => {
  try {
    const data = await service.createCandidate({
      user: req.user,
      payload: req.body || {},
    })

    return res.status(201).json({ data })
  } catch (error) {
    const statusCode = error?.statusCode || 500
    if (statusCode >= 500) {
      console.error('[createProductTemplateCandidateController] error:', error)
    }
    return res.status(statusCode).json({
      error: error?.message || 'Failed to create product template candidate',
      code: error?.code || 'PRODUCT_TEMPLATE_CANDIDATE_CREATE_FAILED',
    })
  }
}

module.exports = { createProductTemplateCandidate }
