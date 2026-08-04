const service = require('./startProductTemplateCandidateReviewService')

const startProductTemplateCandidateReview = async (req, res) => {
  try {
    const data = await service.startReview({
      user: req.user,
      candidateId: req.params?.id,
    })
    return res.status(200).json({ data })
  } catch (error) {
    const statusCode = error?.statusCode || 500
    if (statusCode >= 500) {
      console.error('[startProductTemplateCandidateReviewController] error:', error)
    }
    return res.status(statusCode).json({
      error: error?.message || 'Failed to start product template candidate review',
      code: error?.code || 'CANDIDATE_START_REVIEW_FAILED',
    })
  }
}

module.exports = { startProductTemplateCandidateReview }
