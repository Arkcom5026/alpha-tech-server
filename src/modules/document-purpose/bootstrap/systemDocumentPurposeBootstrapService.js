'use strict'

const {
  LIFECYCLE_STATES,
  canonicalJson,
  hashDocumentPurposeEvent,
  hashDocumentPurposeSnapshot,
  normalizeDocumentPurposeCode,
} = require('../shared/documentPurposeDomain')
const {
  SYSTEM_DOCUMENT_PURPOSES,
} = require('./systemDocumentPurposeCatalog')
const {
  SystemDocumentPurposeBootstrapRepository,
  isKnownRequestError,
} = require('./systemDocumentPurposeBootstrapRepository')

const BOOTSTRAP_EVENT_TYPE = 'SYSTEM_BOOTSTRAPPED'
const BOOTSTRAP_REASON_CODE = 'SYSTEM_CATALOG_V1'

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

const normalizeActorEmployeeId = (value) => {
  if (value == null || value === '') return null
  return asPositiveInt(value, 'actorEmployeeId')
}

const comparableProjection = (purpose) => ({
  code: purpose.code,
  normalizedCode: normalizeDocumentPurposeCode(purpose.code),
  displayName: purpose.displayName,
  description: purpose.description ?? null,
  categoryCode: purpose.categoryCode ?? null,
  isSystem: true,
  lifecycleState: LIFECYCLE_STATES.ACTIVE,
  sortOrder: purpose.sortOrder ?? 0,
  metadata: purpose.metadata ?? null,
})

const isEquivalentSystemDefinition = (existing, expected) =>
  existing.isSystem === true &&
  existing.code === expected.code &&
  existing.normalizedCode === expected.normalizedCode &&
  existing.displayName === expected.displayName &&
  (existing.description ?? null) === expected.description &&
  (existing.categoryCode ?? null) === expected.categoryCode &&
  existing.lifecycleState === expected.lifecycleState &&
  existing.sortOrder === expected.sortOrder &&
  canonicalJson(existing.metadata ?? null) === canonicalJson(expected.metadata ?? null)

class SystemDocumentPurposeBootstrapService {
  constructor(repository = new SystemDocumentPurposeBootstrapRepository()) {
    this.repository = repository
  }

  async execute({ branchId, actorEmployeeId = null } = {}) {
    const normalizedBranchId = asPositiveInt(branchId, 'branchId')
    const normalizedActorEmployeeId = normalizeActorEmployeeId(actorEmployeeId)

    const branch = await this.repository.branchExists(normalizedBranchId)
    if (!branch) {
      throw domainError(
        'DOCUMENT_PURPOSE_BRANCH_NOT_FOUND',
        'Branch does not exist',
        404,
        { branchId: normalizedBranchId },
      )
    }

    const catalog = SYSTEM_DOCUMENT_PURPOSES.map(comparableProjection)
    const existingRows = await this.repository.findByNormalizedCodes(
      normalizedBranchId,
      catalog.map((purpose) => purpose.normalizedCode),
    )
    const existingByCode = new Map(existingRows.map((row) => [row.normalizedCode, row]))

    const existing = []
    const missing = []

    for (const expected of catalog) {
      const current = existingByCode.get(expected.normalizedCode)
      if (!current) {
        missing.push(expected)
        continue
      }

      if (!current.isSystem) {
        throw domainError(
          'DOCUMENT_PURPOSE_SYSTEM_CODE_CONFLICT',
          'A custom document purpose already owns a reserved system code',
          409,
          { branchId: normalizedBranchId, definitionId: current.id, code: expected.code },
        )
      }

      if (!isEquivalentSystemDefinition(current, expected)) {
        throw domainError(
          'DOCUMENT_PURPOSE_SYSTEM_DRIFT',
          'Existing system document purpose differs from the certified catalog',
          409,
          { branchId: normalizedBranchId, definitionId: current.id, code: expected.code },
        )
      }

      existing.push(current)
    }

    if (missing.length === 0) {
      return {
        branchId: normalizedBranchId,
        created: [],
        existing,
        changed: false,
      }
    }

    try {
      const created = await this.repository.transaction(async (tx) => {
        const rows = []

        for (const expected of missing) {
          const definition = await tx.createDefinition({
            branchId: normalizedBranchId,
            ...expected,
            currentVersion: 1,
            createdByEmployeeId: normalizedActorEmployeeId,
            updatedByEmployeeId: normalizedActorEmployeeId,
            archivedAt: null,
          })

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
            changeReason: 'Initial system catalog bootstrap',
            snapshotHash,
            createdByEmployeeId: normalizedActorEmployeeId,
          })

          const eventIdentity = {
            definitionId: definition.id,
            versionId: version.id,
            eventType: BOOTSTRAP_EVENT_TYPE,
            previousState: null,
            resultingState: LIFECYCLE_STATES.ACTIVE,
            actorEmployeeId: normalizedActorEmployeeId,
            reasonCode: BOOTSTRAP_REASON_CODE,
            note: null,
            metadata: { systemCatalogVersion: 1 },
            idempotencyKey: `system-catalog-v1:${expected.normalizedCode}`,
          }

          const event = await tx.createEvent({
            ...eventIdentity,
            eventHash: hashDocumentPurposeEvent(eventIdentity),
          })

          rows.push({ definition, version, event })
        }

        return rows
      })

      return {
        branchId: normalizedBranchId,
        created,
        existing,
        changed: true,
      }
    } catch (error) {
      if (isKnownRequestError(error, 'P2002')) {
        throw domainError(
          'DOCUMENT_PURPOSE_SYSTEM_BOOTSTRAP_CONFLICT',
          'System document purpose bootstrap conflicted with a concurrent or existing record',
          409,
        )
      }
      throw error
    }
  }
}

module.exports = {
  BOOTSTRAP_EVENT_TYPE,
  BOOTSTRAP_REASON_CODE,
  SystemDocumentPurposeBootstrapService,
  isEquivalentSystemDefinition,
}
