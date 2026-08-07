'use strict'

const {
  LIFECYCLE_STATES,
  hashDocumentPurposeEvent,
  hashDocumentPurposeSnapshot,
  normalizeDocumentPurposeCode,
} = require('../shared/documentPurposeDomain')
const {
  DocumentPurposeCreateRepository,
  isKnownRequestError,
} = require('./documentPurposeCreateRepository')

const domainError = (code, message, statusCode = 400, detail) => {
  const error = new Error(message)
  error.code = code
  error.statusCode = statusCode
  if (detail !== undefined) error.detail = detail
  return error
}

const asPositiveInt = (value, field) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw domainError('DOCUMENT_PURPOSE_CONTEXT_INVALID', `${field} must be a positive integer`)
  }
  return parsed
}

const asRequiredText = (value, field, maxLength) => {
  const normalized = String(value ?? '').trim()
  if (!normalized) {
    throw domainError('DOCUMENT_PURPOSE_VALIDATION_ERROR', `${field} is required`)
  }
  if (maxLength && normalized.length > maxLength) {
    throw domainError('DOCUMENT_PURPOSE_VALIDATION_ERROR', `${field} exceeds ${maxLength} characters`)
  }
  return normalized
}

const asOptionalText = (value, maxLength) => {
  if (value == null || String(value).trim() === '') return null
  const normalized = String(value).trim()
  if (maxLength && normalized.length > maxLength) {
    throw domainError('DOCUMENT_PURPOSE_VALIDATION_ERROR', `value exceeds ${maxLength} characters`)
  }
  return normalized
}

const asSortOrder = (value) => {
  if (value == null || value === '') return 0
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) {
    throw domainError('DOCUMENT_PURPOSE_VALIDATION_ERROR', 'sortOrder must be an integer')
  }
  return parsed
}

const buildCreateState = ({ actor, input }) => {
  const branchId = asPositiveInt(actor?.branchId, 'branchId')
  const employeeId = asPositiveInt(actor?.employeeId, 'employeeId')
  const code = asRequiredText(input?.code, 'code', 100)
  const normalizedCode = normalizeDocumentPurposeCode(code)
  const displayName = asRequiredText(input?.displayName, 'displayName', 160)
  const description = asOptionalText(input?.description)
  const categoryCode = asOptionalText(input?.categoryCode, 100)
  const sortOrder = asSortOrder(input?.sortOrder)
  const metadata = input?.metadata ?? null

  return {
    branchId,
    employeeId,
    definition: {
      branchId,
      code,
      normalizedCode,
      displayName,
      description,
      categoryCode,
      isSystem: false,
      lifecycleState: LIFECYCLE_STATES.ACTIVE,
      sortOrder,
      metadata,
      currentVersion: 1,
      createdByEmployeeId: employeeId,
      updatedByEmployeeId: employeeId,
      archivedAt: null,
    },
    changeReason: asOptionalText(input?.changeReason),
    reasonCode: asOptionalText(input?.reasonCode, 100),
    note: asOptionalText(input?.note),
    eventMetadata: input?.eventMetadata ?? null,
    idempotencyKey: asOptionalText(input?.idempotencyKey, 160),
  }
}

class DocumentPurposeCreateService {
  constructor(repository = new DocumentPurposeCreateRepository()) {
    this.repository = repository
  }

  async execute({ actor, input = {} } = {}) {
    const state = buildCreateState({ actor, input })
    const duplicate = await this.repository.findByNormalizedCode(
      state.branchId,
      state.definition.normalizedCode,
    )
    if (duplicate) {
      throw domainError(
        'DOCUMENT_PURPOSE_DUPLICATE_CODE',
        'Document purpose code already exists in this branch',
        409,
        { definitionId: duplicate.id, normalizedCode: duplicate.normalizedCode },
      )
    }

    try {
      return await this.repository.transaction(async (tx) => {
        const definition = await tx.createDefinition(state.definition)
        const snapshot = {
          code: definition.code,
          normalizedCode: definition.normalizedCode,
          displayName: definition.displayName,
          description: definition.description,
          categoryCode: definition.categoryCode,
          isSystem: definition.isSystem,
          lifecycleState: definition.lifecycleState,
          sortOrder: definition.sortOrder,
          metadata: definition.metadata,
        }
        const snapshotHash = hashDocumentPurposeSnapshot(snapshot)

        const version = await tx.createVersion({
          definitionId: definition.id,
          version: 1,
          ...snapshot,
          changeReason: state.changeReason,
          snapshotHash,
          createdByEmployeeId: state.employeeId,
        })

        const eventIdentity = {
          definitionId: definition.id,
          versionId: version.id,
          eventType: 'CREATED',
          previousState: null,
          resultingState: LIFECYCLE_STATES.ACTIVE,
          actorEmployeeId: state.employeeId,
          reasonCode: state.reasonCode,
          note: state.note,
          metadata: state.eventMetadata,
          idempotencyKey: state.idempotencyKey,
        }

        const event = await tx.createEvent({
          ...eventIdentity,
          eventHash: hashDocumentPurposeEvent(eventIdentity),
        })

        return { definition, version, event }
      })
    } catch (error) {
      if (isKnownRequestError(error, 'P2002')) {
        throw domainError(
          'DOCUMENT_PURPOSE_DUPLICATE_CODE',
          'Document purpose code already exists or the request conflicts with an existing immutable record',
          409,
        )
      }
      throw error
    }
  }
}

module.exports = {
  DocumentPurposeCreateService,
  buildCreateState,
}
