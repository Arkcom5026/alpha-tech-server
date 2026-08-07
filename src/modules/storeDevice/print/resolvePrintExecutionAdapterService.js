'use strict'

const {
  assertExecutionEnvelope,
  assertPrintExecutionAdapter,
} = require('./printExecutionAdapterContract')
const {
  dryRunPrintExecutionAdapter,
} = require('./adapters/dryRunPrintExecutionAdapter')

const fail = (code, message, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode })

const normalizeAdapterCode = (value) => String(value || 'DRY_RUN').trim().toUpperCase()

const createResolvePrintExecutionAdapterService = ({
  adapters = { DRY_RUN: dryRunPrintExecutionAdapter },
} = {}) => ({
  execute({ executionEnvelope, adapterCode = 'DRY_RUN' }) {
    const envelope = assertExecutionEnvelope(executionEnvelope)
    const normalizedCode = normalizeAdapterCode(adapterCode)
    const adapter = adapters[normalizedCode]

    if (!adapter) {
      throw fail(
        'STORE_DEVICE_PRINT_ADAPTER_NOT_FOUND',
        `Print execution adapter is not registered: ${normalizedCode}`,
        404,
      )
    }

    assertPrintExecutionAdapter(adapter)

    if (!adapter.supports(envelope)) {
      throw fail(
        'STORE_DEVICE_PRINT_ADAPTER_UNSUPPORTED',
        `Print execution adapter does not support this execution envelope: ${normalizedCode}`,
        409,
      )
    }

    return Object.freeze({
      adapterCode: normalizedCode,
      adapter,
      capabilities: adapter.capabilities(),
    })
  },
})

module.exports = {
  createResolvePrintExecutionAdapterService,
}
