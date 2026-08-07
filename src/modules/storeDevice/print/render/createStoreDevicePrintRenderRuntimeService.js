'use strict'

const {
  assertExecutionEnvelope,
} = require('../printExecutionAdapterContract')
const {
  createResolvePrintRenderService,
} = require('./resolvePrintRenderService')
const {
  createSaleReceipt80mmPdfRenderService,
} = require('./createSaleReceipt80mmPdfRenderService')

const PURPOSE_FORMATS = Object.freeze({
  SALE_RECEIPT: 'SALE_RECEIPT_80MM_PDF',
})

const fail = (code, message, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode })

const createStoreDevicePrintRenderRuntimeService = ({
  saleReceiptRenderer,
  saleReceiptRendererOptions,
} = {}) => {
  const receiptRenderer = saleReceiptRenderer
    || createSaleReceipt80mmPdfRenderService(saleReceiptRendererOptions)

  const resolver = createResolvePrintRenderService({
    renderers: {
      SALE_RECEIPT_80MM_PDF: receiptRenderer,
    },
  })

  const resolveForEnvelope = ({ executionEnvelope }) => {
    const envelope = assertExecutionEnvelope(executionEnvelope)
    const purposeCode = String(envelope.documentPurpose.code || '').trim().toUpperCase()
    const format = PURPOSE_FORMATS[purposeCode]

    if (!format) {
      throw fail(
        'STORE_DEVICE_PRINT_PURPOSE_RENDERER_UNAVAILABLE',
        `No certified runtime renderer is registered for document purpose: ${purposeCode}`,
        409,
      )
    }

    return Object.freeze({
      purposeCode,
      format,
      renderer: resolver.resolve({ format }),
    })
  }

  return Object.freeze({
    resolveForEnvelope,

    async render({ executionEnvelope }) {
      const resolved = resolveForEnvelope({ executionEnvelope })
      const artifact = await resolved.renderer.execute({ executionEnvelope })
      return Object.freeze({
        purposeCode: resolved.purposeCode,
        format: resolved.format,
        artifact,
      })
    },

    supportedPurposeCodes() {
      return Object.freeze(Object.keys(PURPOSE_FORMATS))
    },
  })
}

module.exports = {
  createStoreDevicePrintRenderRuntimeService,
}
