'use strict'

const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const {
  createPdfPrintRenderService,
} = require('../src/modules/storeDevice/print/render/pdfPrintRenderService')

const createEnvelope = () => Object.freeze({
  schemaVersion: 1,
  job: Object.freeze({ jobId: 'job-1', jobType: 'PRINT_DOCUMENT' }),
  lease: Object.freeze({ leaseId: 'lease-1' }),
  documentPurpose: Object.freeze({ code: 'DELIVERY_NOTE', displayName: 'Delivery Note' }),
  source: Object.freeze({ type: 'SALE', id: 42 }),
  print: Object.freeze({ copies: 1 }),
  projection: Object.freeze({ document: Object.freeze({ saleId: 42 }) }),
})

;(async () => {
  assert.throws(
    () => createPdfPrintRenderService(),
    (error) => error.code === 'STORE_DEVICE_PRINT_PDF_RENDERER_REQUIRED',
  )

  const invalidRenderer = createPdfPrintRenderService({
    renderPdf: async () => ({ buffer: Buffer.from('not-pdf'), pageCount: 1 }),
  })
  await assert.rejects(
    () => invalidRenderer.execute({ executionEnvelope: createEnvelope() }),
    (error) => error.code === 'STORE_DEVICE_PRINT_PDF_SIGNATURE_INVALID',
  )

  const pdfBuffer = Buffer.from('%PDF-1.7\n% certified candidate\n%%EOF\n', 'ascii')
  const envelope = createEnvelope()
  const projectionBefore = JSON.stringify(envelope.projection)

  const service = createPdfPrintRenderService({
    rendererName: 'TEST_PDF_RENDERER',
    renderPdf: async ({ documentPurpose, source, projection, print }) => {
      assert.strictEqual(documentPurpose.code, 'DELIVERY_NOTE')
      assert.deepStrictEqual(source, { type: 'SALE', id: 42 })
      assert.strictEqual(projection.document.saleId, 42)
      assert.strictEqual(print.copies, 1)
      return { buffer: pdfBuffer, pageCount: 2 }
    },
  })

  const artifact = await service.execute({ executionEnvelope: envelope })

  assert.strictEqual(artifact.schemaVersion, 1)
  assert.strictEqual(artifact.format, 'PDF')
  assert.strictEqual(artifact.mediaType, 'application/pdf')
  assert.strictEqual(artifact.renderer, 'TEST_PDF_RENDERER')
  assert.strictEqual(artifact.physicalSideEffects, false)
  assert.strictEqual(artifact.documentPurpose.code, 'DELIVERY_NOTE')
  assert.strictEqual(artifact.source.type, 'SALE')
  assert.strictEqual(artifact.source.id, 42)
  assert.strictEqual(artifact.pageCount, 2)
  assert.strictEqual(artifact.byteLength, pdfBuffer.length)
  assert.strictEqual(
    artifact.checksum,
    crypto.createHash('sha256').update(pdfBuffer).digest('hex'),
  )
  assert.strictEqual(artifact.payload.encoding, 'base64')
  assert.deepStrictEqual(Buffer.from(artifact.payload.data, 'base64'), pdfBuffer)
  assert.strictEqual(JSON.stringify(envelope.projection), projectionBefore)
  assert.strictEqual(Object.isFrozen(artifact), true)
  assert.strictEqual(Object.isFrozen(artifact.payload), true)

  const source = fs.readFileSync(
    path.join(__dirname, '../src/modules/storeDevice/print/render/pdfPrintRenderService.js'),
    'utf8',
  )
  for (const forbidden of [
    'child_process',
    'powershell',
    'Get-Printer',
    'WinSpool',
    'prisma',
    '$executeRaw',
  ]) {
    assert.strictEqual(source.includes(forbidden), false, `forbidden primitive: ${forbidden}`)
  }

  console.log('store-device-print-pdf-render-candidate.contract.test.js: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
