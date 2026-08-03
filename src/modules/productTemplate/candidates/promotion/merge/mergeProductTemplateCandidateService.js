const repository = require('./mergeProductTemplateCandidateRepository')
const {
  assertSuperAdmin,
  createHttpError,
  resolveActorEmployeeId,
  toPositiveInt,
} = require('../../shared/productTemplateCandidatePolicy')

const normalizeDecisionNote = (value) => {
  const note = String(value || '').trim().replace(/\s+/g, ' ')
  if (note.length > 2000) {
    throw createHttpError(400, 'decisionNote must not exceed 2000 characters', 'CANDIDATE_DECISION_NOTE_TOO_LONG')
  }
  return note || null
}

const mergeCandidate = async ({ user, candidateId, payload }) => {
  assertSuperAdmin(user)

  const id = toPositiveInt(candidateId, 'candidateId')
  const targetTemplateProductId = toPositiveInt(
    payload?.targetTemplateProductId,
    'targetTemplateProductId'
  )
  const actorEmployeeId = resolveActorEmployeeId(user)
  const decisionNote = normalizeDecisionNote(payload?.decisionNote)
  const reviewedAt = new Date()

  const result = await repository.mergeCandidateTransaction({
    candidateId: id,
    targetTemplateProductId,
    actorEmployeeId,
    decisionNote,
    reviewedAt,
  })

  if (result.transitioned) return result

  if (!result.current) {
    throw createHttpError(404, 'Product template candidate was not found', 'CANDIDATE_NOT_FOUND')
  }

  if (!result.targetTemplateProduct) {
    throw createHttpError(
      422,
      'Target Product is not a Product Template in the candidate target branch',
      'TARGET_TEMPLATE_PRODUCT_INVALID'
    )
  }

  throw createHttpError(
    409,
    `Candidate cannot be merged from status ${result.current.status}`,
    'CANDIDATE_MERGE_TRANSITION_CONFLICT'
  )
}

module.exports = {
  normalizeDecisionNote,
  mergeCandidate,
}
