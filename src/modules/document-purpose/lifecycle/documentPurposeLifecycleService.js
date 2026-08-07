'use strict'

const {
  assertLifecycleTransition,
  hashDocumentPurposeEvent,
  hashDocumentPurposeSnapshot,
} = require('../shared/documentPurposeDomain')
const {
  DocumentPurposeLifecycleRepository,
  isKnownRequestError,
} = require('./documentPurposeLifecycleRepository')

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

const eventTypeFor = (targetState) => ({
  ACTIVE: 'ACTIVATED',
  INACTIVE: 'DEACTIVATED',
  ARCHIVED: 'ARCHIVED',
})[targetState]

class DocumentPurposeLifecycleService {
  constructor(repository = new DocumentPurposeLifecycleRepository()) {
    this.repository = repository
  }

  async execute({ actor, definitionId, input = {} } = {}) {
    const branchId = asPositiveInt(actor?.branchId, 'branchId')
    const employeeId = asPositiveInt(actor?.employeeId, 'employeeId')
    const id = asPositiveInt(definitionId, 'definitionId')
    const targetState = String(input.targetState ?? '').trim().toUpperCase()
    const idempotencyKey = asOptionalText(input.idempotencyKey, 160)

    if (idempotencyKey) {
      const replay = await this.repository.findEventByIdempotencyKey({ branchId, definitionId: id, idempotencyKey })
      if (replay) {
        const expectedEventType = eventTypeFor(targetState)
        if (!expectedEventType || replay.eventType !== expectedEventType) {
          throw domainError('DOCUMENT_PURPOSE_IDEMPOTENCY_CONFLICT', 'Idempotency key was already used for another mutation', 409)
        }
        return { definition: replay.definition, version: replay.version, event: replay, replayed: true }
      }
    }

    const current = await this.repository.findCurrent({ branchId, definitionId: id })
    if (!current) throw domainError('DOCUMENT_PURPOSE_NOT_FOUND', 'Document purpose not found', 404)

    const transition = assertLifecycleTransition(current.lifecycleState, targetState)
    if (!transition.changed) {
      return { definition: current, version: null, event: null, changed: false }
    }

    if (current.isSystem && transition.to === 'ARCHIVED') {
      throw domainError(
        'DOCUMENT_PURPOSE_SYSTEM_POLICY_FORBIDDEN',
        'System document purposes cannot be archived by normal runtime policy',
        403,
      )
    }

    const nextVersion = Number(current.currentVersion) + 1
    const candidate = {
      ...current,
      lifecycleState: transition.to,
      archivedAt: transition.to === 'ARCHIVED' ? new Date() : current.archivedAt,
    }
    const candidateSnapshot = snapshotOf(candidate)
    const snapshotHash = hashDocumentPurposeSnapshot(candidateSnapshot)
    const changeReason = asOptionalText(input.changeReason)
    const reasonCode = asOptionalText(input.reasonCode, 100)
    const note = asOptionalText(input.note)
    const eventMetadata = input.eventMetadata ?? null
    const eventType = eventTypeFor(transition.to)

    try {
      return await this.repository.transaction(async (tx) => {
        const updated = await tx.updateDefinitionIfVersion({
          branchId,
          definitionId: id,
          expectedVersion: current.currentVersion,
          data: {
            lifecycleState: transition.to,
            archivedAt: candidate.archivedAt,
            currentVersion: nextVersion,
            updatedByEmployeeId: employeeId,
          },
        })

        if (updated.count !== 1) {
          throw domainError(
            'DOCUMENT_PURPOSE_CONCURRENT_UPDATE',
            'Document purpose changed before this lifecycle mutation could commit',
            409,
            { expectedVersion: current.currentVersion },
          )
        }

        const version = await tx.createVersion({
          definitionId: id,
          version: nextVersion,
          ...candidateSnapshot,
          changeReason,
          snapshotHash,
          createdByEmployeeId: employeeId,
        })

        const eventIdentity = {
          definitionId: id,
          versionId: version.id,
          eventType,
          previousState: transition.from,
          resultingState: transition.to,
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
          'Document purpose lifecycle mutation conflicts with an existing version or idempotent mutation',
          409,
        )
      }
      throw error
    }
  }
}

module.exports = {
  DocumentPurposeLifecycleService,
  eventTypeFor,
}
