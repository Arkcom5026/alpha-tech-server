'use strict'

const {
  assertExecutionEnvelope,
} = require('../printExecutionAdapterContract')
const {
  createInspectWindowsBrowserPdfRendererReadinessService,
} = require('./inspectWindowsBrowserPdfRendererReadinessService')
const {
  createWindowsBrowserPdfTransport,
} = require('./windowsBrowserPdfTransport')
const {
  createPdfPrintRenderService,
} = require('./pdfPrintRenderService')

const fail = (code, message, statusCode = 400, detail = undefined) =>
  Object.assign(new Error(message), { code, statusCode, detail })

const nonEmptyHtml = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw fail(
      'STORE_DEVICE_PRINT_BROWSER_HTML_RENDER_INVALID',
      'Browser PDF HTML renderer must return non-empty HTML',
      500,
    )
  }
  return value
}

const createWindowsBrowserPdfPrintRenderService = ({
  renderHtml,
  readinessService = createInspectWindowsBrowserPdfRendererReadinessService(),
  transport = createWindowsBrowserPdfTransport(),
} = {}) => {
  if (typeof renderHtml !== 'function') {
    throw fail(
      'STORE_DEVICE_PRINT_BROWSER_HTML_RENDERER_REQUIRED',
      'A certified HTML renderer is required for Windows browser PDF rendering',
      500,
    )
  }

  const pdfRenderer = createPdfPrintRenderService({
    rendererName: 'WINDOWS_BROWSER_PDF',
    async renderPdf({ documentPurpose, source, projection, print }) {
      const readiness = readinessService.execute()
      if (readiness?.ready !== true || !readiness.selectedRenderer?.executablePath) {
        throw fail(
          'STORE_DEVICE_PRINT_BROWSER_PDF_NOT_READY',
          'Windows browser PDF renderer readiness must pass before rendering',
          409,
          { reasons: readiness?.reasons || [] },
        )
      }

      const html = nonEmptyHtml(await renderHtml({
        documentPurpose,
        source,
        projection,
        print,
      }))

      const result = await transport.execute({
        browserExecutablePath: readiness.selectedRenderer.executablePath,
        html,
      })

      return {
        buffer: result.pdfBytes,
        pageCount: Number(result.pageCount || 1),
      }
    },
  })

  return Object.freeze({
    code: 'WINDOWS_BROWSER_PDF',
    physicalSideEffects: false,
    localProcessSideEffects: true,
    filesystemSideEffects: true,

    async execute({ executionEnvelope }) {
      const envelope = assertExecutionEnvelope(executionEnvelope)
      return pdfRenderer.execute({ executionEnvelope: envelope })
    },
  })
}

module.exports = {
  createWindowsBrowserPdfPrintRenderService,
}
