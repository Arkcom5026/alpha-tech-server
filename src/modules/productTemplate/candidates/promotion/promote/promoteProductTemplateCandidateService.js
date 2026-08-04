const repository = require('./promoteProductTemplateCandidateRepository')
const {
  assertSuperAdmin,
  createHttpError,
  resolveActorEmployeeId,
  toPositiveInt,
} = require('../../shared/productTemplateCandidatePolicy')

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ')

const optionalPositiveInt = (value) => {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createHttpError(400, 'Optional identifier fields must be positive integers', 'INVALID_TEMPLATE_DATA')
  }
  return parsed
}

const normalizeTemplateData = (payload = {}) => {
  const name = normalizeText(payload.name)
  if (!name) {
    throw createHttpError(400, 'name is required', 'TEMPLATE_NAME_REQUIRED')
  }
  if (name.length > 255) {
    throw createHttpError(400, 'name must not exceed 255 characters', 'TEMPLATE_NAME_TOO_LONG')
  }

  const mode = normalizeText(payload.mode).toUpperCase()
  if (mode && !['SIMPLE', 'STRUCTURED'].includes(mode)) {
    throw createHttpError(400, 'mode must be SIMPLE or STRUCTURED', 'INVALID_TEMPLATE_MODE')
  }

  const productTypeId = toPositiveInt(payload.productTypeId, 'productTypeId')
  const warrantyDays = optionalPositiveInt(payload.warrantyDays)

  return {
    name,
    active: payload.active === undefined ? true : Boolean(payload.active),
    mode: mode || 'STRUCTURED',
    noSN: Boolean(payload.noSN),
    trackSerialNumber: Boolean(payload.trackSerialNumber),
    productTypeId,
    brandId: optionalPositiveInt(payload.brandId),
    unitId: optionalPositiveInt(payload.unitId),
    codeType: payload.codeType ? normalizeText(payload.codeType) : null,
    productConfig: payload.productConfig ?? null,
    warrantyDays,
  }
}

const normalizeDecisionNote = (value) => {
  const note = normalizeText(value)
  if (note.length > 2000) {
    throw createHttpError(400, 'decisionNote must not exceed 2000 characters', 'CANDIDATE_DECISION_NOTE_TOO_LONG')
  }
  return note || null
}

const promoteCandidate = async ({ user, candidateId, payload }) => {
  assertSuperAdmin(user)

  const id = toPositiveInt(candidateId, 'candidateId')
  const templateData = normalizeTemplateData(payload || {})
  const decisionNote = normalizeDecisionNote(payload?.decisionNote)
  const actorEmployeeId = resolveActorEmployeeId(user)
  const promotedAt = new Date()

  const result = await repository.promoteCandidateTransaction({
    candidateId: id,
    actorEmployeeId,
    reviewedAt: promotedAt,
    promotedAt,
    decisionNote,
    templateData,
  })

  if (result.transitioned) return result

  if (result.invalidTemplateProductType) {
    throw createHttpError(
      422,
      'productTypeId must belong to the candidate target Template Branch',
      'TEMPLATE_PRODUCT_TYPE_INVALID'
    )
  }

  if (!result.current) {
    throw createHttpError(404, 'Product template candidate was not found', 'CANDIDATE_NOT_FOUND')
  }

  throw createHttpError(
    409,
    `Candidate cannot be promoted from status ${result.current.status}`,
    'CANDIDATE_PROMOTE_TRANSITION_CONFLICT'
  )
}

module.exports = {
  normalizeTemplateData,
  promoteCandidate,
}
