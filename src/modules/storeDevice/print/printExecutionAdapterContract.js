'use strict'

const PRINT_EXECUTION_STATUSES = Object.freeze([
  'SUCCEEDED',
  'FAILED',
  'TIMEOUT',
  'OFFLINE',
  'PAPER_OUT',
  'UNSUPPORTED',
])

const STATUS_SET = new Set(PRINT_EXECUTION_STATUSES)

const fail = (code, message, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode })

const nonEmpty = (value, code, field) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw fail(code, `${field} is required`)
  }
  return value.trim()
}

const assertExecutionEnvelope = (envelope) => {
  if (
    envelope?.schemaVersion !== 1
    || envelope?.job?.jobType !== 'PRINT_DOCUMENT'
    || typeof envelope?.job?.jobId !== 'string'
    || !envelope.job.jobId.trim()
    || typeof envelope?.lease?.leaseId !== 'string'
    || !envelope.lease.leaseId.trim()
    || typeof envelope?.documentPurpose?.code !== 'string'
    || !envelope.documentPurpose.code.trim()
    || typeof envelope?.source?.type !== 'string'
    || !envelope.source.type.trim()
    || !Number.isInteger(Number(envelope?.source?.id))
    || Number(envelope.source.id) <= 0
    || !Number.isInteger(Number(envelope?.print?.copies))
    || Number(envelope.print.copies) <= 0
    || !envelope?.projection
  ) {
    throw fail(
      'STORE_DEVICE_PRINT_EXECUTION_ENVELOPE_INVALID',
      'Print execution envelope is not compatible with the adapter contract',
      409,
    )
  }
  return envelope
}

const assertPrintExecutionAdapter = (adapter) => {
  if (
    !adapter
    || typeof adapter.name !== 'string'
    || !adapter.name.trim()
    || typeof adapter.supports !== 'function'
    || typeof adapter.execute !== 'function'
    || typeof adapter.cancel !== 'function'
    || typeof adapter.capabilities !== 'function'
  ) {
    throw fail(
      'STORE_DEVICE_PRINT_ADAPTER_INVALID',
      'Print execution adapter does not implement the required contract',
      500,
    )
  }
  return adapter
}

const createPrintExecutionResult = ({
  adapter,
  status,
  durationMs = 0,
  evidence = null,
  error = null,
}) => {
  const adapterName = nonEmpty(adapter, 'STORE_DEVICE_PRINT_ADAPTER_NAME_REQUIRED', 'adapter')
  if (!STATUS_SET.has(status)) {
    throw fail('STORE_DEVICE_PRINT_EXECUTION_STATUS_INVALID', 'Unsupported print execution status')
  }
  const normalizedDuration = Number(durationMs)
  if (!Number.isFinite(normalizedDuration) || normalizedDuration < 0) {
    throw fail('STORE_DEVICE_PRINT_EXECUTION_DURATION_INVALID', 'durationMs must be a non-negative number')
  }

  return Object.freeze({
    schemaVersion: 1,
    adapter: adapterName,
    status,
    durationMs: normalizedDuration,
    evidence,
    error,
  })
}

module.exports = {
  PRINT_EXECUTION_STATUSES,
  assertExecutionEnvelope,
  assertPrintExecutionAdapter,
  createPrintExecutionResult,
}
