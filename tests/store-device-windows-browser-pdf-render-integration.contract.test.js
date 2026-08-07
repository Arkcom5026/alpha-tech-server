'use strict'

const assert = require('assert')
const {
  createWindowsBrowserPdfPrintRenderService,
} = require('../src/modules/storeDevice/print/render/windowsBrowserPdfPrintRenderService')
const {
  createAdmitWindowsPrintArtifactService,
} = require('../src/modules/storeDevice/print/adapters/windows/admitWindowsPrintArtifactService')

const executionEnvelope = Object.freeze({
  schemaVersion: 1,
  job: Object.freeze({ id: 101 }),
  lease: Object.freeze({ id: 202 }),
  documentPurpose: Object.freeze({
    code: 'DELIVERY_NOTE',
    displayName: 'ใบส่งสินค้า',
  }),
  source: Object.freeze({ type: 'SALE', id: 303 }),
  print: Object.freeze({ copies: 1 }),
  projection: Object.freeze({
    document: Object.freeze({ title: 'ใบส่งสินค้า' }),
    total: 1234.56,
  }),
})

const readinessService = Object.freeze({
  execute() {
    return Object.freeze({
      schemaVersion: 1,
      strategy: 'LOCAL_GATEWAY_BROWSER_PDF',
      ready: true,
      reasons: Object.freeze([]),
      selectedRenderer: Object.freeze({
        browser: 'EDGE',
        executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      }),
    })
  },
})

const transportCalls = []
const transport = Object.freeze({
  async execute(input) {
    transportCalls.push(input)
    return Object.freeze({
      renderer: 'WINDOWS_BROWSER_PDF',
      pdfBytes: Buffer.from('%PDF-1.7\nalpha-tech-thai-render\n'),
      pageCount: 1,
    })
  },
})

async function main() {
  assert.throws(
    () => createWindowsBrowserPdfPrintRenderService(),
    (error) => error.code === 'STORE_DEVICE_PRINT_BROWSER_HTML_RENDERER_REQUIRED',
  )

  const service = createWindowsBrowserPdfPrintRenderService({
    readinessService,
    transport,
    renderHtml({ documentPurpose, projection }) {
      assert.strictEqual(documentPurpose.code, 'DELIVERY_NOTE')
      assert.strictEqual(projection.total, 1234.56)
      return '<!doctype html><html lang="th"><body>ใบส่งสินค้า ภาษาไทย</body></html>'
    },
  })

  const artifact = await service.execute({ executionEnvelope })

  assert.strictEqual(artifact.format, 'PDF')
  assert.strictEqual(artifact.mediaType, 'application/pdf')
  assert.strictEqual(artifact.renderer, 'WINDOWS_BROWSER_PDF')
  assert.strictEqual(artifact.physicalSideEffects, false)
  assert.strictEqual(artifact.documentPurpose.code, 'DELIVERY_NOTE')
  assert.strictEqual(artifact.source.id, 303)
  assert.strictEqual(artifact.pageCount, 1)
  assert.ok(artifact.byteLength > 5)
  assert.match(artifact.checksum, /^[a-f0-9]{64}$/)
  assert.strictEqual(artifact.payload.encoding, 'base64')
  assert.strictEqual(transportCalls.length, 1)
  assert.match(transportCalls[0].html, /ภาษาไทย/)
  assert.match(transportCalls[0].browserExecutablePath, /msedge\.exe$/i)

  const admission = createAdmitWindowsPrintArtifactService().execute({
    artifact,
    readiness: Object.freeze({
      schemaVersion: 1,
      adapterCode: 'WINDOWS_SPOOLER',
      ready: true,
      reasons: Object.freeze([]),
      selectedPrinter: Object.freeze({
        name: 'EPSON L3210 Series',
        isOnline: true,
        driverName: 'Epson ESC/P-R V4 Class Driver',
        portName: 'USB001',
      }),
    }),
  })

  assert.strictEqual(admission.admitted, true)
  assert.strictEqual(admission.artifact.format, 'PDF')
  assert.strictEqual(admission.printer.name, 'EPSON L3210 Series')

  const blocked = createWindowsBrowserPdfPrintRenderService({
    renderHtml: () => '<html></html>',
    transport,
    readinessService: Object.freeze({
      execute() {
        return Object.freeze({ ready: false, reasons: Object.freeze(['NO_BROWSER']) })
      },
    }),
  })

  await assert.rejects(
    () => blocked.execute({ executionEnvelope }),
    (error) => error.code === 'STORE_DEVICE_PRINT_BROWSER_PDF_NOT_READY',
  )

  console.log('store-device-windows-browser-pdf-render-integration.contract.test.js: PASS')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
