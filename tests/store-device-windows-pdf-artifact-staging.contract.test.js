'use strict'

const assert = require('assert')
const crypto = require('crypto')
const {
  createPrintRenderArtifact,
} = require('../src/modules/storeDevice/print/render/printRenderArtifactContract')
const {
  createStageWindowsPdfPrintArtifactService,
} = require('../src/modules/storeDevice/print/adapters/windows/stageWindowsPdfPrintArtifactService')

const pdfBytes = Buffer.from('%PDF-1.7\nalpha-tech-sale-receipt\n')
const checksum = crypto.createHash('sha256').update(pdfBytes).digest('hex')

const artifact = createPrintRenderArtifact({
  format: 'PDF',
  mediaType: 'application/pdf',
  renderer: 'WINDOWS_BROWSER_PDF',
  documentPurpose: { code: 'SALE_RECEIPT', displayName: 'ใบเสร็จรับเงิน' },
  source: { type: 'PAYMENT', id: 638 },
  pageCount: 1,
  byteLength: pdfBytes.length,
  checksum,
  payload: {
    encoding: 'base64',
    data: pdfBytes.toString('base64'),
  },
  physicalSideEffects: false,
})

const files = new Map()
const calls = []
const notFound = () => Object.assign(new Error('not found'), { code: 'ENOENT' })

const fsPromises = Object.freeze({
  async mkdir(target, options) {
    calls.push(['mkdir', target, options])
  },
  async readFile(target) {
    calls.push(['readFile', target])
    if (!files.has(target)) throw notFound()
    return Buffer.from(files.get(target))
  },
  async writeFile(target, bytes, options) {
    calls.push(['writeFile', target, options])
    assert.strictEqual(options.flag, 'wx')
    if (files.has(target)) throw Object.assign(new Error('exists'), { code: 'EEXIST' })
    files.set(target, Buffer.from(bytes))
  },
  async rename(from, to) {
    calls.push(['rename', from, to])
    if (!files.has(from)) throw notFound()
    files.set(to, Buffer.from(files.get(from)))
    files.delete(from)
  },
  async unlink(target) {
    calls.push(['unlink', target])
    files.delete(target)
  },
})

async function main() {
  const service = createStageWindowsPdfPrintArtifactService({
    fsPromises,
    platform: 'win32',
    artifactRoot: 'C:\\AlphaTech\\print-artifacts',
    randomId: () => 'attempt-1',
  })

  const first = await service.execute({ artifact })
  assert.strictEqual(first.mode, 'WINDOWS_PDF_ARTIFACT_STAGED')
  assert.strictEqual(first.physicalSideEffects, false)
  assert.strictEqual(first.filesystemSideEffects, true)
  assert.strictEqual(first.executionEnabled, false)
  assert.strictEqual(first.persistence.reusedExisting, false)
  assert.strictEqual(first.artifact.checksum, checksum)
  assert.strictEqual(
    first.artifact.filePath,
    `C:\\AlphaTech\\print-artifacts\\${checksum}.pdf`,
  )
  assert.deepStrictEqual(files.get(first.artifact.filePath), pdfBytes)
  assert.strictEqual(first.safety.checksumVerified, true)
  assert.strictEqual(first.safety.processExecutionPerformed, false)
  assert.strictEqual(first.safety.spoolSubmissionPerformed, false)

  const writesAfterFirst = calls.filter(([name]) => name === 'writeFile').length
  const second = await service.execute({ artifact })
  assert.strictEqual(second.persistence.reusedExisting, true)
  assert.strictEqual(
    calls.filter(([name]) => name === 'writeFile').length,
    writesAfterFirst,
  )

  const tampered = Object.freeze({
    ...artifact,
    payload: Object.freeze({
      encoding: 'base64',
      data: Buffer.from('%PDF-1.7\ntampered\n').toString('base64'),
    }),
  })

  await assert.rejects(
    () => service.execute({ artifact: tampered }),
    (error) => [
      'STORE_DEVICE_WINDOWS_PDF_STAGING_PAYLOAD_INVALID',
      'STORE_DEVICE_WINDOWS_PDF_STAGING_CHECKSUM_MISMATCH',
    ].includes(error.code),
  )

  const nonWindows = createStageWindowsPdfPrintArtifactService({
    fsPromises,
    platform: 'linux',
    artifactRoot: 'C:\\AlphaTech\\print-artifacts',
  })
  await assert.rejects(
    () => nonWindows.execute({ artifact }),
    (error) => error.code === 'STORE_DEVICE_WINDOWS_PDF_STAGING_PLATFORM_REQUIRED',
  )

  files.set(first.artifact.filePath, Buffer.from('%PDF-1.7\nwrong-existing-file\n'))
  await assert.rejects(
    () => service.execute({ artifact }),
    (error) => error.code === 'STORE_DEVICE_WINDOWS_PDF_STAGING_EXISTING_ARTIFACT_MISMATCH',
  )

  console.log('store-device-windows-pdf-artifact-staging.contract.test.js: PASS')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
