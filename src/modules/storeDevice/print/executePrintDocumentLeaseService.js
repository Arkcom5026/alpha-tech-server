'use strict'

const {
  PRINT_EXECUTION_STATUSES,
  assertExecutionEnvelope,
} = require('./printExecutionAdapterContract')
const {
  createResolvePrintExecutionAdapterService,
} = require('./resolvePrintExecutionAdapterService')
const {
  createPrintDocumentExecutionService,
} = require('./completePrintDocumentJobService')

const STATUS_SET = new Set(PRINT_EXECUTION_STATUSES)

const fail = (code, message, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode })

const nonEmpty = (value, code, field) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw fail(code, `${field} is required`)
  }
  return value.trim()
}

const assertAdapterResult = ({ result, adapterCode }) => {
  if (
    result?.schemaVersion !== 1
    || result?.adapter !== adapterCode
    || !STATUS_SET.has(result?.status)
    || !Number.isFinite(Number(result?.durationMs))
    || Number(result.durationMs) < 0
  ) {
    throw fail(
      'STORE_DEVICE_PRINT_ADAPTER_RESULT_INVALID',
      'Print adapter returned an invalid execution result',
      502,
    )
  }
  return result
}

const executionFailureMetadata = ({ adapterCode, result = null, error = null }) => ({
  code:
    result?.error?.code
    || error?.code
    || `STORE_DEVICE_PRINT_${result?.status || 'ADAPTER_EXECUTION_FAILED'}`,
  adapter: adapterCode,
  adapterStatus: result?.status || 'FAILED',
  message: error?.message || null,
  adapterError: result?.error || null,
})

const createExecutePrintDocumentLeaseService = ({
  resolverService = createResolvePrintExecutionAdapterService(),
  executionService = createPrintDocumentExecutionService(),
} = {}) => ({
  async execute({
    user,
    executionEnvelope,
    gatewayId,
    sessionId,
    resultId,
    adapterCode = 'DRY_RUN',
    adapterOptions = {},
  }) {
    const envelope = assertExecutionEnvelope(executionEnvelope)
    const normalizedGatewayId = nonEmpty(
      gatewayId,
      'STORE_DEVICE_PRINT_GATEWAY_ID_REQUIRED',
      'gatewayId',
    )
    const normalizedSessionId = nonEmpty(
      sessionId,
      'STORE_DEVICE_PRINT_SESSION_ID_REQUIRED',
      'sessionId',
    )
    const normalizedResultId = nonEmpty(
      resultId,
      'STORE_DEVICE_PRINT_RESULT_ID_REQUIRED',
      'resultId',
    )

    const resolved = resolverService.execute({
      executionEnvelope: envelope,
      adapterCode,
    })

    await executionService.acknowledge({
      user,
      leaseId: envelope.lease.leaseId,
      payload: {
        gatewayId: normalizedGatewayId,
        sessionId: normalizedSessionId,
      },
    })

    let adapterResult
    try {
      adapterResult = assertAdapterResult({
        result: await resolved.adapter.execute(envelope, adapterOptions),
        adapterCode: resolved.adapterCode,
      })
    } catch (error) {
      const failureSnapshot = Object.freeze({
        schemaVersion: 1,
        adapter: resolved.adapterCode,
        status: 'FAILED',
        durationMs: 0,
        evidence: null,
        error: Object.freeze({
          code: error?.code || 'STORE_DEVICE_PRINT_ADAPTER_EXECUTION_THROWN',
          message: error?.message || 'Print adapter execution failed',
        }),
      })

      const completion = await executionService.complete({
        user,
        leaseId: envelope.lease.leaseId,
        status: 'FAILED',
        payload: {
          gatewayId: normalizedGatewayId,
          sessionId: normalizedSessionId,
          resultId: normalizedResultId,
          executionSnapshot: failureSnapshot,
          adapterEvidence: {
            adapter: resolved.adapterCode,
            capabilities: resolved.capabilities,
          },
          errorMetadata: executionFailureMetadata({
            adapterCode: resolved.adapterCode,
            error,
          }),
        },
      })

      return Object.freeze({
        adapterCode: resolved.adapterCode,
        adapterCapabilities: resolved.capabilities,
        adapterResult: failureSnapshot,
        lifecycleStatus: 'FAILED',
        completion,
      })
    }

    const lifecycleStatus = adapterResult.status === 'SUCCEEDED'
      ? 'SUCCEEDED'
      : 'FAILED'

    const completion = await executionService.complete({
      user,
      leaseId: envelope.lease.leaseId,
      status: lifecycleStatus,
      payload: {
        gatewayId: normalizedGatewayId,
        sessionId: normalizedSessionId,
        resultId: normalizedResultId,
        executionSnapshot: adapterResult,
        adapterEvidence: {
          adapter: resolved.adapterCode,
          capabilities: resolved.capabilities,
          evidence: adapterResult.evidence || null,
        },
        errorMetadata: lifecycleStatus === 'FAILED'
          ? executionFailureMetadata({
              adapterCode: resolved.adapterCode,
              result: adapterResult,
            })
          : null,
      },
    })

    return Object.freeze({
      adapterCode: resolved.adapterCode,
      adapterCapabilities: resolved.capabilities,
      adapterResult,
      lifecycleStatus,
      completion,
    })
  },
})

module.exports = {
  createExecutePrintDocumentLeaseService,
}
