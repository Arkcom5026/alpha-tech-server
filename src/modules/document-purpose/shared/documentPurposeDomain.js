'use strict'

const crypto = require('crypto')

const LIFECYCLE_STATES = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  ARCHIVED: 'ARCHIVED',
})

const LIFECYCLE_TRANSITIONS = Object.freeze({
  ACTIVE: Object.freeze(new Set(['INACTIVE', 'ARCHIVED'])),
  INACTIVE: Object.freeze(new Set(['ACTIVE', 'ARCHIVED'])),
  ARCHIVED: Object.freeze(new Set()),
})

const MUTABLE_FIELDS = Object.freeze([
  'displayName',
  'description',
  'categoryCode',
  'sortOrder',
  'metadata',
])

const SNAPSHOT_FIELDS = Object.freeze([
  'code',
  'normalizedCode',
  'displayName',
  'description',
  'categoryCode',
  'isSystem',
  'lifecycleState',
  'sortOrder',
  'metadata',
])

const domainError = (code, message, detail) => {
  const error = new Error(message)
  error.code = code
  if (detail !== undefined) error.detail = detail
  return error
}

const normalizeDocumentPurposeCode = (value) => {
  const normalized = String(value ?? '')
    .trim()
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  if (!normalized) {
    throw domainError('DOCUMENT_PURPOSE_CODE_REQUIRED', 'Document purpose code is required')
  }

  if (!/^[A-Z0-9_]+$/.test(normalized)) {
    throw domainError(
      'DOCUMENT_PURPOSE_CODE_INVALID',
      'Document purpose code may contain only A-Z, 0-9 and underscore after normalization',
    )
  }

  if (normalized.length > 100) {
    throw domainError('DOCUMENT_PURPOSE_CODE_TOO_LONG', 'Document purpose code exceeds 100 characters')
  }

  return normalized
}

const canonicalize = (value) => {
  if (value === null) return null
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(canonicalize)
  if (typeof value !== 'object') return value

  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      if (value[key] !== undefined) result[key] = canonicalize(value[key])
      return result
    }, {})
}

const canonicalJson = (value) => JSON.stringify(canonicalize(value))

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')

const buildDocumentPurposeSnapshot = (definition = {}) =>
  SNAPSHOT_FIELDS.reduce((snapshot, field) => {
    snapshot[field] = definition[field] ?? null
    return snapshot
  }, {})

const hashDocumentPurposeSnapshot = (definition) =>
  sha256(canonicalJson(buildDocumentPurposeSnapshot(definition)))

const buildDocumentPurposeEventIdentity = ({
  definitionId,
  versionId = null,
  eventType,
  previousState = null,
  resultingState = null,
  actorEmployeeId = null,
  reasonCode = null,
  note = null,
  metadata = null,
  idempotencyKey = null,
} = {}) => ({
  definitionId: definitionId ?? null,
  versionId,
  eventType: eventType ?? null,
  previousState,
  resultingState,
  actorEmployeeId,
  reasonCode,
  note,
  metadata,
  idempotencyKey,
})

const hashDocumentPurposeEvent = (input) =>
  sha256(canonicalJson(buildDocumentPurposeEventIdentity(input)))

const assertLifecycleState = (state) => {
  const normalized = String(state ?? '').trim().toUpperCase()
  if (!Object.prototype.hasOwnProperty.call(LIFECYCLE_STATES, normalized)) {
    throw domainError('DOCUMENT_PURPOSE_LIFECYCLE_INVALID', `Unsupported lifecycle state: ${state}`)
  }
  return normalized
}

const assertLifecycleTransition = (fromState, toState) => {
  const from = assertLifecycleState(fromState)
  const to = assertLifecycleState(toState)

  if (from === to) {
    return Object.freeze({ from, to, changed: false })
  }

  if (!LIFECYCLE_TRANSITIONS[from].has(to)) {
    throw domainError(
      'DOCUMENT_PURPOSE_LIFECYCLE_TRANSITION_INVALID',
      `Document purpose lifecycle transition ${from} -> ${to} is not allowed`,
      { from, to },
    )
  }

  return Object.freeze({ from, to, changed: true })
}

const pickMutableDocumentPurposeFields = (input = {}) =>
  MUTABLE_FIELDS.reduce((result, field) => {
    if (Object.prototype.hasOwnProperty.call(input, field)) result[field] = input[field]
    return result
  }, {})

module.exports = Object.freeze({
  LIFECYCLE_STATES,
  MUTABLE_FIELDS,
  SNAPSHOT_FIELDS,
  assertLifecycleState,
  assertLifecycleTransition,
  buildDocumentPurposeEventIdentity,
  buildDocumentPurposeSnapshot,
  canonicalJson,
  hashDocumentPurposeEvent,
  hashDocumentPurposeSnapshot,
  normalizeDocumentPurposeCode,
  pickMutableDocumentPurposeFields,
})
