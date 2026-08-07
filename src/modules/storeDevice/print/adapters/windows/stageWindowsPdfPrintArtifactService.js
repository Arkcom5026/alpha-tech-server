'use strict'

const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {
  assertPrintRenderArtifact,
} = require('../../render/printRenderArtifactContract')

const fail = (code, message, statusCode = 409, detail = undefined) =>
  Object.assign(new Error(message), { code, statusCode, detail })

const sha256 = (buffer) => crypto
  .createHash('sha256')
  .update(buffer)
  .digest('hex')

const createStageWindowsPdfPrintArtifactService = ({
  fsPromises = fs.promises,
  platform = process.platform,
  artifactRoot = process.env.ALPHATECH_PRINT_ARTIFACT_DIR
    || path.join(os.tmpdir(), 'alpha-tech-store-device-print'),
  randomId = () => crypto.randomUUID(),
} = {}) => Object.freeze({
  async execute({ artifact }) {
    if (platform !== 'win32') {
      throw fail(
        'STORE_DEVICE_WINDOWS_PDF_STAGING_PLATFORM_REQUIRED',
        'Windows PDF artifact staging requires a Windows runtime',
      )
    }

    const normalizedArtifact = assertPrintRenderArtifact(artifact)
    if (
      normalizedArtifact.format !== 'PDF'
      || normalizedArtifact.mediaType !== 'application/pdf'
      || normalizedArtifact.payload?.encoding !== 'base64'
      || typeof normalizedArtifact.payload?.data !== 'string'
      || !normalizedArtifact.payload.data
    ) {
      throw fail(
        'STORE_DEVICE_WINDOWS_PDF_STAGING_ARTIFACT_INVALID',
        'Windows PDF staging requires a certified base64 PDF artifact',
      )
    }

    const checksum = String(normalizedArtifact.checksum || '').trim().toLowerCase()
    if (!/^[a-f0-9]{64}$/.test(checksum)) {
      throw fail(
        'STORE_DEVICE_WINDOWS_PDF_STAGING_CHECKSUM_INVALID',
        'Windows PDF staging requires a SHA-256 artifact checksum',
      )
    }

    const pdfBytes = Buffer.from(normalizedArtifact.payload.data, 'base64')
    if (
      pdfBytes.length < 5
      || pdfBytes.subarray(0, 5).toString('ascii') !== '%PDF-'
      || pdfBytes.length !== Number(normalizedArtifact.byteLength)
    ) {
      throw fail(
        'STORE_DEVICE_WINDOWS_PDF_STAGING_PAYLOAD_INVALID',
        'Decoded PDF artifact does not match the certified PDF payload contract',
      )
    }

    const actualChecksum = sha256(pdfBytes)
    if (actualChecksum !== checksum) {
      throw fail(
        'STORE_DEVICE_WINDOWS_PDF_STAGING_CHECKSUM_MISMATCH',
        'Decoded PDF artifact checksum does not match the certified artifact checksum',
        409,
        { expectedChecksum: checksum, actualChecksum },
      )
    }

    const root = path.win32.resolve(String(artifactRoot || '').trim())
    if (!path.win32.isAbsolute(root)) {
      throw fail(
        'STORE_DEVICE_WINDOWS_PDF_STAGING_ROOT_INVALID',
        'Windows PDF staging root must be an absolute Windows path',
      )
    }

    const finalFilePath = path.win32.join(root, `${checksum}.pdf`)
    const tempFilePath = path.win32.join(root, `.${checksum}.${randomId()}.tmp`)

    await fsPromises.mkdir(root, { recursive: true })
    await fsPromises.writeFile(tempFilePath, pdfBytes, { flag: 'wx' })

    try {
      await fsPromises.rename(tempFilePath, finalFilePath)
    } catch (error) {
      try {
        await fsPromises.unlink(tempFilePath)
      } catch (_cleanupError) {
        // Preserve the primary staging failure.
      }
      throw error
    }

    return Object.freeze({
      schemaVersion: 1,
      mode: 'WINDOWS_PDF_ARTIFACT_STAGED',
      physicalSideEffects: false,
      filesystemSideEffects: true,
      executionEnabled: false,
      artifact: Object.freeze({
        filePath: finalFilePath,
        format: normalizedArtifact.format,
        mediaType: normalizedArtifact.mediaType,
        renderer: normalizedArtifact.renderer,
        checksum,
        byteLength: pdfBytes.length,
        pageCount: normalizedArtifact.pageCount,
      }),
      safety: Object.freeze({
        payloadSignatureVerified: true,
        byteLengthVerified: true,
        checksumVerified: true,
        deterministicFinalPath: true,
        processExecutionPerformed: false,
        spoolSubmissionPerformed: false,
        requiresTransportReadiness: true,
        requiresExplicitPhysicalAuthorization: true,
        requiresDedicatedPhysicalExecutor: true,
      }),
    })
  },
})

module.exports = {
  createStageWindowsPdfPrintArtifactService,
}
