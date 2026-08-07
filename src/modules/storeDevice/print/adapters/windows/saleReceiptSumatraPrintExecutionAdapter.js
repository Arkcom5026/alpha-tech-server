'use strict'

const {
  assertExecutionEnvelope,
  createPrintExecutionResult,
} = require('../../printExecutionAdapterContract')
const {
  createSaleReceiptSumatraPhysicalAuthorizationRuntimeService,
} = require('./createSaleReceiptSumatraPhysicalAuthorizationRuntimeService')
const {
  createExecuteAuthorizedSumatraPdfPhysicalPrintService,
} = require('./executeAuthorizedSumatraPdfPhysicalPrintService')

const ADAPTER_NAME = 'SALE_RECEIPT_SUMATRA'

const fail = (code, message, statusCode = 409, detail = undefined) =>
  Object.assign(new Error(message), { code, statusCode, detail })

const createSaleReceiptSumatraPrintExecutionAdapter = ({
  authorizationRuntimeService = createSaleReceiptSumatraPhysicalAuthorizationRuntimeService(),
  physicalExecutor = createExecuteAuthorizedSumatraPdfPhysicalPrintService(),
  now = () => Date.now(),
} = {}) => Object.freeze({
  name: ADAPTER_NAME,

  supports(executionEnvelope) {
    try {
      const envelope = assertExecutionEnvelope(executionEnvelope)
      return String(envelope.documentPurpose.code || '').trim().toUpperCase() === 'SALE_RECEIPT'
    } catch (_error) {
      return false
    }
  },

  capabilities() {
    return Object.freeze({
      adapter: ADAPTER_NAME,
      dryRun: false,
      physicalSideEffects: true,
      supportedJobTypes: Object.freeze(['PRINT_DOCUMENT']),
      supportedDocumentPurposes: Object.freeze(['SALE_RECEIPT']),
      transport: 'SUMATRA_PDF',
      resultSemantics: 'SUBMISSION_CONFIRMED_NOT_PHYSICAL_OUTPUT_CONFIRMED',
      requiresExplicitPhysicalApproval: true,
      requiresExactPrinterMatch: true,
    })
  },

  async execute(executionEnvelope, options = {}) {
    const envelope = assertExecutionEnvelope(executionEnvelope)
    if (String(envelope.documentPurpose.code || '').trim().toUpperCase() !== 'SALE_RECEIPT') {
      throw fail(
        'STORE_DEVICE_SALE_RECEIPT_SUMATRA_PURPOSE_UNSUPPORTED',
        'Sale Receipt Sumatra adapter supports SALE_RECEIPT only',
      )
    }

    const startedAt = Number(now())

    const authorized = await authorizationRuntimeService.execute({
      executionEnvelope: envelope,
      readiness: options.readiness,
      approvalToken: options.approvalToken,
      expectedPrinterName: options.expectedPrinterName,
    })

    const submitted = await physicalExecutor.execute({
      authorization: authorized.authorization,
    })

    if (
      submitted?.schemaVersion !== 1
      || submitted?.mode !== 'PHYSICAL_EXECUTION_SUBMITTED'
      || submitted?.physicalSideEffects !== true
      || submitted?.executionEnabled !== true
      || submitted?.result?.submitted !== true
      || submitted?.printer?.name !== authorized?.authorization?.printer?.name
    ) {
      throw fail(
        'STORE_DEVICE_SALE_RECEIPT_SUMATRA_SUBMISSION_INVALID',
        'Sale Receipt Sumatra executor did not return certified submission evidence',
        502,
      )
    }

    const finishedAt = Number(now())
    const durationMs = Number.isFinite(startedAt) && Number.isFinite(finishedAt)
      ? Math.max(0, finishedAt - startedAt)
      : 0

    return createPrintExecutionResult({
      adapter: ADAPTER_NAME,
      status: 'SUCCEEDED',
      durationMs,
      evidence: Object.freeze({
        schemaVersion: 1,
        meaning: 'PRINT_SUBMISSION_ACCEPTED',
        physicalOutputConfirmed: false,
        processExecutionPerformed: true,
        spoolSubmissionAttempted: true,
        submissionAccepted: true,
        documentPurposeCode: envelope.documentPurpose.code,
        sourceType: envelope.source.type,
        sourceId: Number(envelope.source.id),
        copies: Number(envelope.print.copies),
        printer: Object.freeze({
          name: submitted.printer.name,
        }),
        transport: Object.freeze({
          code: submitted.transport.code,
          strategy: submitted.transport.strategy,
        }),
        artifact: Object.freeze({ ...submitted.artifact }),
        executorMode: submitted.mode,
      }),
      error: null,
    })
  },

  async cancel(executionEnvelope) {
    const envelope = assertExecutionEnvelope(executionEnvelope)
    return Object.freeze({
      adapter: ADAPTER_NAME,
      cancelled: false,
      cancellationSupported: false,
      physicalSideEffects: false,
      jobId: envelope.job.jobId,
      leaseId: envelope.lease.leaseId,
      reason: 'SUMATRA_SUBMISSION_CANNOT_BE_RELIABLY_CANCELLED_AFTER_PROCESS_START',
    })
  },
})

module.exports = {
  ADAPTER_NAME,
  createSaleReceiptSumatraPrintExecutionAdapter,
}
