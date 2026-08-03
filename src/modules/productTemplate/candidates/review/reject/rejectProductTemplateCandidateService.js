const repository = require('./rejectProductTemplateCandidateRepository')
const {
  assertSuperAdmin,
  createHttpError,
  resolveActorEmployeeId,
  toPositiveInt,
} = require('../../shared/productTemplateCandidatePolicy')

const normalizeDecisionNote = (value) => {
  const note = String(value || '').trim().replace(/\s+/g, ' ')
  if (!note) {
    throw createHttpError(400, 'decisionNote is required', 'CANDIDATE_REJECTION_REASON_REQUIRED')
  }
  if (note.length > 2000) {
    throw createHttpError(400, 'decisionNote must not exceed 2000 characters', 'CANDIDATE_REJECTION_REASON_TOO_LONG')
  }
  return note
}

const rejectCandidate = async ({ user, candidateId, payload }) => {
  assertSuperAdmin(user)

  const id = toPositiveInt(candidateId, 'candidateId')
  const decisionNote = normalizeDecisionNote(payload?.decisionNote)
  const actorEmployeeId = resolveActorEmployeeId(user)
  const reviewedAt = new Date()

  const result = await repository.rejectCandidateTransaction({
    candidateId: id,
    actorEmployeeId,
    decisionNote,
    reviewedAt,
  })

  if (result.transitioned) return result

  if (!result.current) {
    throw createHttpError(404, 'Product template candidate was not found', 'CANDIDATE_NOT_FOUND')
  }

  throw createHttpError(
    409,
    `Candidate cannot be rejected from status ${result.current.status}`,
    'CANDIDATE_REJECT_TRANSITION_CONFLICT'
  )
}

module.exports = {
  normalizeDecisionNote,
  rejectCandidate,
}
