const repository = require('./startProductTemplateCandidateReviewRepository')
const {
  assertSuperAdmin,
  createHttpError,
  resolveActorEmployeeId,
  toPositiveInt,
} = require('../../shared/productTemplateCandidatePolicy')

const startReview = async ({ user, candidateId }) => {
  assertSuperAdmin(user)

  const id = toPositiveInt(candidateId, 'candidateId')
  const actorEmployeeId = resolveActorEmployeeId(user)
  const reviewedAt = new Date()

  const result = await repository.startReviewTransaction({
    candidateId: id,
    actorEmployeeId,
    reviewedAt,
  })

  if (result.transitioned) return result

  if (!result.current) {
    throw createHttpError(404, 'Product template candidate was not found', 'CANDIDATE_NOT_FOUND')
  }

  throw createHttpError(
    409,
    `Candidate cannot start review from status ${result.current.status}`,
    'CANDIDATE_REVIEW_TRANSITION_CONFLICT'
  )
}

module.exports = { startReview }
