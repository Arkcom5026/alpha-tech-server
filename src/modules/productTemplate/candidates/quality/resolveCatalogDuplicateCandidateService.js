const repository = require('./resolveCatalogDuplicateCandidateRepository')
const { assertSuperAdmin, createHttpError, resolveActorEmployeeId, toPositiveInt } = require('../shared/productTemplateCandidatePolicy')

const normalizeDecisionNote = (value) => {
  const note = String(value || '').trim().replace(/\s+/g, ' ')
  if (note.length > 2000) {
    throw createHttpError(400, 'decisionNote must not exceed 2000 characters', 'CANDIDATE_DECISION_NOTE_TOO_LONG')
  }
  return note || null
}

const resolveCatalogDuplicateCandidate = async ({ user, candidateId, payload = {} }) => {
  assertSuperAdmin(user)
  const id = toPositiveInt(candidateId, 'candidateId')
  const canonicalTemplateProductId = toPositiveInt(payload.canonicalTemplateProductId, 'canonicalTemplateProductId')
  const duplicateTemplateProductId = toPositiveInt(payload.duplicateTemplateProductId, 'duplicateTemplateProductId')
  if (canonicalTemplateProductId === duplicateTemplateProductId) {
    throw createHttpError(400, 'Canonical and duplicate Template Products must be different', 'CANDIDATE_DUPLICATE_RESOLUTION_INVALID')
  }

  const result = await repository.resolveDuplicateTransaction({
    candidateId: id,
    canonicalTemplateProductId,
    duplicateTemplateProductId,
    actorEmployeeId: resolveActorEmployeeId(user),
    decisionNote: normalizeDecisionNote(payload.decisionNote),
    resolvedAt: new Date(),
  })

  if (['RESOLVED', 'ALREADY_RESOLVED'].includes(result.outcome)) return result
  if (result.outcome === 'NOT_FOUND') {
    throw createHttpError(404, 'Product Template Candidate was not found', 'CANDIDATE_NOT_FOUND')
  }
  if (result.outcome === 'INVALID_STATUS') {
    throw createHttpError(409, 'Candidate status does not allow duplicate resolution', 'CANDIDATE_DUPLICATE_RESOLUTION_STATUS_CONFLICT')
  }
  throw createHttpError(422, 'Duplicate resolution request does not match Candidate authority', 'CANDIDATE_DUPLICATE_RESOLUTION_INVALID')
}

module.exports = { normalizeDecisionNote, resolveCatalogDuplicateCandidate }
