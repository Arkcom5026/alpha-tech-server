'use strict'

const {
  hashDocumentPurposeEvent,
  hashDocumentPurposeSnapshot,
  pickMutableDocumentPurposeFields,
} = require('../shared/documentPurposeDomain')
const {
  DocumentPurposeUpdateRepository,
  isKnownRequestError,
} = require('./documentPurposeUpdateRepository')

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

const asOptionalText = (value, maxLength) => {
  if (value == null || String(value).trim() === '') return null
  const normalized = String(value).trim()
  if (maxLength && normalized.length > maxLength) {
    throw domainError('DOCUMENT_PURPOSE_VALIDATION_ERROR', `value exceeds ${maxLength} characters`)
  }
  return normalized
}

const normalizeMutableFields = (input = {}) => {
  const picked = pickMutableDocumentPurposeFields(input)
  const result = {}

  if (Object.prototype.hasOwnProperty.call(picked, 'displayName')) {
    const value = String(picked.displayName ?? '').trim()
    if (!value) throw domainError('DOCUMENT_PURPOSE_VALIDATION_ERROR', 'displayName is required')
    if (value.length > 160) throw domainError('DOCUMENT_PURPOSE_VALIDATION_ERROR', 'displayName exceeds 160 characters')
    result.displayName = value
  }

  if (Object.prototype.hasOwnProperty.call(picked, 'description')) {
    result.description = asOptionalText(picked.description)
  }

  if (Object.prototype.hasOwnProperty.call(picked, 'categoryCode')) {
    result.categoryCode = asOptionalText(picked.categoryCode, 100)
  }

  if (Object.prototype.hasOwnProperty.call(picked, 'sortOrder')) {
    const value = Number(picked.sortOrder)
    if (!Number.isInteger(value)) {
      throw domainError('DOCUMENT_PURPOSE_VALIDATION_ERROR', 'sortOrder must be an integer')
    }
    result.sortOrder = value
  }

  if (Object.prototype.hasOwnProperty.call(picked, 'metadata')) {
    result.metadata = picked.metadata ?? null
  }

  return result
}

const assertImmutableFieldsUntouched = (input = {}) => {
  const immutable = ['branchId', 'code', 'normalizedCode', 'isSystem', 'lifecycleState', 'currentVersion', 'archivedAt']
  const attempted = immutable.filter((field) => Object.prototype.hasOwnProperty.call(input, field))
  if (attempted.length) {
    throw domainError(
      'DOCUMENT_PURPOSE_IMMUTABLE_FIELD',
      'Immutable document purpose fields cannot be changed by update runtime',
      400,
      { fields: attempted },
    )
  }
}

const snapshotOf = (definition) => ({
  code: definition.code,
  normalizedCode: definition.normalizedCode,
  displayName: definition.displayName,
  description: definition.description,
  categoryCode: definition.categoryCode,
  isSystem: definition.isSystem,
  lifecycleState: definition.lifecycleState,
  sortOrder: definition.sortOrder,
  metadata: definition.metadata,
})

class DocumentPurposeUpdateService {
  constructor(repository = new DocumentPurposeUpdateRepository()) {
    this.repository = repository
  }

  async execute({ actor, definitionId, input = {} } = {}) {
    const branchId = asPositiveInt(actor?.branchId, 'branchId')
    const employeeId = asPositiveInt(actor?.employeeId, 'employeeId')
    const id = asPositiveInt(definitionId, 'definitionId')
    assertImmutableFieldsUntouched(input)

    const idempotencyKey = asOptionalText(input.idempotencyKey, 160)
    if (idempotencyKey) {
      const replay = await this.repository.findEventByIdempotencyKey({ branchId, definitionId: id, idempotencyKey })
      if (replay) {
        if (replay.eventType !== 'UPDATED') {
          throw domainError('DOCUMENT_PURPOSE_IDEMPOTENCY_CONFLICT', 'Idempotency key was already used for another mutation', 409)
        }
        return { definition: replay.definition, version: replay.version, event: replay, replayed: true }
      }
    }

    const current = await this.repository.findCurrent({ branchId, definitionId: id })
    if (!current) {
      throw domainError('DOCUMENT_PURPOSE_NOT_FOUND', 'Document purpose not found', 404)
    }

    const changes = normalizeMutableFields(input)
    const candidate = { ...current, ...changes }
    const currentHash = hashDocumentPurposeSnapshot(snapshotOf(current))
    const candidateSnapshot = snapshotOf(candidate)
    const candidateHash = hashDocumentPurposeSnapshot(candidateSnapshot)

    if (candidateHash === currentHash) {
      return { definition: current, version: null, event: null, changed: false }
    }

    const nextVersion = Number(current.currentVersion) + 1
    const changeReason = asOptionalText(input.changeReason)
    const reasonCode = asOptionalText(input.reasonCode, 100)
    const note = asOptionalText(input.note)
    const eventMetadata = input.eventMetadata ?? { changedFields: Object.keys(changes) }

    try {
      return await this.repository.transaction(async (tx) => {
        const updated = await tx.updateDefinitionIfVersion({
          branchId,
          definitionId: id,
          expectedVersion: current.currentVersion,
          data: {
            ...changes,
            currentVersion: nextVersion,
            updatedByEmployeeId: employeeId,
          },
        })

        if (updated.count !== 1) {
          throw domainError(
            'DOCUMENT_PURPOSE_CONCURRENT_UPDATE',
            'Document purpose changed before this update could commit',
            409,
            { expectedVersion: current.currentVersion },
          )
        }

        const version = await tx.createVersion({
          definitionId: id,
          version: nextVersion,
          ...candidateSnapshot,
          changeReason,
          snapshotHash: candidateHash,
          createdByEmployeeId: employeeId,
        })

        const eventIdentity = {
          definitionId: id,
          versionId: version.id,
          eventType: 'UPDATED',
          previousState: current.lifecycleState,
          resultingState: current.lifecycleState,
          actorEmployeeId: employeeId,
          reasonCode,
          note,
          metadata: eventMetadata,
          idempotencyKey,
        }

        const event = await tx.createEvent({
          ...eventIdentity,
          eventHash: hashDocumentPurposeEvent(eventIdentity),
        })

        const definition = await tx.findById({ branchId, definitionId: id })
        return { definition, version, event, changed: true }
      })
    } catch (error) {
      if (isKnownRequestError(error, 'P2002')) {
        throw domainError(
          'DOCUMENT_PURPOSE_CONFLICT',
          'Document purpose update conflicts with an existing version or idempotent mutation',
          409,
        )
      }
      throw error
    }
  }
}

module.exports = {
  DocumentPurposeUpdateService,
  assertImmutableFieldsUntouched,
  normalizeMutableFields,
}
