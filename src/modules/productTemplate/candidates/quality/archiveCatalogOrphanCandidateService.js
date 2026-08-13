const repository = require('./archiveCatalogOrphanCandidateRepository')
const {
  assertSuperAdmin,
  createHttpError,
  resolveActorEmployeeId,
  toPositiveInt,
} = require('../shared/productTemplateCandidatePolicy')

const normalizeDecisionNote = (value) => {
  const note = String(value || '').trim()
  return note || null
}

const archiveCatalogOrphanCandidate = async ({
  user,
  candidateId,
  payload = {},
}) => {
  assertSuperAdmin(user)

  const id = toPositiveInt(candidateId, 'candidateId')
  const actorEmployeeId = resolveActorEmployeeId(user)
  const decisionNote = normalizeDecisionNote(
    payload.decisionNote ?? payload.note
  )
  const resolvedAt = new Date()

  const result =
    await repository.archiveCatalogOrphanCandidateTransaction({
      candidateId: id,
      actorEmployeeId,
      decisionNote,
      resolvedAt,
    })

  switch (result.outcome) {
    case 'ARCHIVED':
      return {
        archived: true,
        idempotent: false,
        candidate: result.candidate,
        templateProductId: result.productId,
        event: result.event,
      }

    case 'ALREADY_ARCHIVED':
      return {
        archived: true,
        idempotent: true,
        candidate: result.candidate,
        templateProductId:
          result.candidate?.primaryTemplateProductId || null,
      }

    case 'NOT_FOUND':
      throw createHttpError(
        404,
        'Catalog quality Candidate was not found',
        'CATALOG_CANDIDATE_NOT_FOUND'
      )

    case 'INVALID_STATE':
      throw createHttpError(
        409,
        'Candidate is not an open Orphan Candidate',
        'ORPHAN_CANDIDATE_INVALID_STATE'
      )

    case 'PRODUCT_INVALID':
      throw createHttpError(
        409,
        'Template Product is no longer valid for this Orphan Candidate',
        'ORPHAN_TEMPLATE_PRODUCT_INVALID'
      )

    case 'STILL_REFERENCED':
      throw createHttpError(
        409,
        `Template Product still has ${result.referenceCount || 0} Local Product reference(s)`,
        'ORPHAN_PRODUCT_STILL_REFERENCED'
      )

    default:
      throw createHttpError(
        500,
        'Unexpected Orphan Candidate archive outcome',
        'ORPHAN_ARCHIVE_UNEXPECTED_OUTCOME'
      )
  }
}

module.exports = {
  normalizeDecisionNote,
  archiveCatalogOrphanCandidate,
}
