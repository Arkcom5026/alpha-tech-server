'use strict'

const fail = (code, message, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode })

const positiveInt = (value, code, field) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw fail(code, `${field} must be a positive integer`)
  }
  return parsed
}

const nonEmpty = (value, code, field) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw fail(code, `${field} is required`)
  }
  return value.trim()
}

const normalizeCopies = (value) => {
  if (value === undefined || value === null || value === '') return 1
  const copies = Number(value)
  if (!Number.isInteger(copies) || copies < 1 || copies > 20) {
    throw fail(
      'STORE_DEVICE_PRINT_COPIES_INVALID',
      'copies must be an integer between 1 and 20',
    )
  }
  return copies
}

const createPrintRequestSnapshot = ({
  documentPurpose,
  sourceType,
  sourceId,
  copies,
  projection,
  routeSnapshot = null,
}) => ({
  schemaVersion: 1,
  documentPurpose,
  source: {
    type: sourceType,
    id: sourceId,
  },
  print: {
    copies,
  },
  route: routeSnapshot,
  projection,
})

const assertIdempotentPrintJobCompatibility = ({
  job,
  sourceType,
  sourceId,
  copies,
  documentPurpose,
}) => {
  const snapshot = job?.requestSnapshot
  if (!snapshot) return

  const compatible =
    snapshot.schemaVersion === 1
    && snapshot.documentPurpose?.code === documentPurpose.code
    && snapshot.source?.type === sourceType
    && Number(snapshot.source?.id) === Number(sourceId)
    && Number(snapshot.print?.copies) === Number(copies)

  if (!compatible) {
    throw fail(
      'STORE_DEVICE_PRINT_IDEMPOTENCY_CONFLICT',
      'idempotencyKey is already bound to a different print request',
      409,
    )
  }
}

module.exports = Object.freeze({
  fail,
  positiveInt,
  nonEmpty,
  normalizeCopies,
  createPrintRequestSnapshot,
  assertIdempotentPrintJobCompatibility,
})
