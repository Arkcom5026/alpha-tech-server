'use strict'

const {
  assertExecutionEnvelope,
  createPrintExecutionResult,
} = require('../printExecutionAdapterContract')

const ADAPTER_NAME = 'DRY_RUN'

const normalizeScenario = (value) => {
  const scenario = String(value || 'SUCCEEDED').trim().toUpperCase()
  const allowed = new Set([
    'SUCCEEDED',
    'FAILED',
    'TIMEOUT',
    'OFFLINE',
    'PAPER_OUT',
    'UNSUPPORTED',
  ])
  return allowed.has(scenario) ? scenario : 'UNSUPPORTED'
}

const dryRunPrintExecutionAdapter = Object.freeze({
  name: ADAPTER_NAME,

  supports(executionEnvelope) {
    try {
      assertExecutionEnvelope(executionEnvelope)
      return true
    } catch (_error) {
      return false
    }
  },

  capabilities() {
    return Object.freeze({
      adapter: ADAPTER_NAME,
      dryRun: true,
      physicalSideEffects: false,
      supportedJobTypes: Object.freeze(['PRINT_DOCUMENT']),
      supportedStatuses: Object.freeze([
        'SUCCEEDED',
        'FAILED',
        'TIMEOUT',
        'OFFLINE',
        'PAPER_OUT',
        'UNSUPPORTED',
      ]),
    })
  },

  async execute(executionEnvelope, options = {}) {
    const envelope = assertExecutionEnvelope(executionEnvelope)
    const status = normalizeScenario(options.scenario)
    const durationMs = Number.isFinite(Number(options.durationMs))
      ? Math.max(0, Number(options.durationMs))
      : 0

    return createPrintExecutionResult({
      adapter: ADAPTER_NAME,
      status,
      durationMs,
      evidence: Object.freeze({
        dryRun: true,
        physicalSideEffects: false,
        jobId: envelope.job.jobId,
        leaseId: envelope.lease.leaseId,
        documentPurposeCode: envelope.documentPurpose.code,
        sourceType: envelope.source.type,
        sourceId: Number(envelope.source.id),
        copies: Number(envelope.print.copies),
      }),
      error: status === 'SUCCEEDED'
        ? null
        : Object.freeze({ code: `DRY_RUN_${status}` }),
    })
  },

  async cancel(executionEnvelope) {
    const envelope = assertExecutionEnvelope(executionEnvelope)
    return Object.freeze({
      adapter: ADAPTER_NAME,
      cancelled: true,
      dryRun: true,
      physicalSideEffects: false,
      jobId: envelope.job.jobId,
      leaseId: envelope.lease.leaseId,
    })
  },
})

module.exports = {
  dryRunPrintExecutionAdapter,
}
