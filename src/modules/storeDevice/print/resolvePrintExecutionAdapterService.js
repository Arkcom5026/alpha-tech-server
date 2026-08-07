'use strict'

const {
  assertExecutionEnvelope,
  assertPrintExecutionAdapter,
} = require('./printExecutionAdapterContract')
const {
  dryRunPrintExecutionAdapter,
} = require('./adapters/dryRunPrintExecutionAdapter')
const {
  createSaleReceiptSumatraPrintExecutionAdapter,
} = require('./adapters/windows/saleReceiptSumatraPrintExecutionAdapter')

const fail = (code, message, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode })

const normalizeAdapterCode = (value) => String(value || 'DRY_RUN').trim().toUpperCase()

const createResolvePrintExecutionAdapterService = ({
  adapters,
} = {}) => {
  const registeredAdapters = adapters || {
    DRY_RUN: dryRunPrintExecutionAdapter,
    SALE_RECEIPT_SUMATRA: createSaleReceiptSumatraPrintExecutionAdapter(),
  }

  return {
    execute({ executionEnvelope, adapterCode = 'DRY_RUN' }) {
      const envelope = assertExecutionEnvelope(executionEnvelope)
      const normalizedCode = normalizeAdapterCode(adapterCode)
      const adapter = registeredAdapters[normalizedCode]

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
  }
}

module.exports = {
  createResolvePrintExecutionAdapterService,
}
