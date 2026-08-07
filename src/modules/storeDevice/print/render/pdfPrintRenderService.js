'use strict'

const crypto = require('crypto')
const {
  assertExecutionEnvelope,
} = require('../printExecutionAdapterContract')
const {
  createPrintRenderArtifact,
} = require('./printRenderArtifactContract')

const fail = (code, message, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode })

const assertPdfBuffer = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 5) {
    throw fail(
      'STORE_DEVICE_PRINT_PDF_RENDER_OUTPUT_INVALID',
      'PDF renderer must return a non-empty Buffer',
      500,
    )
  }

  if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw fail(
      'STORE_DEVICE_PRINT_PDF_SIGNATURE_INVALID',
      'PDF renderer output does not contain a valid PDF signature',
      500,
    )
  }

  return buffer
}

const createPdfPrintRenderService = ({ renderPdf, rendererName = 'PDF_CANDIDATE' } = {}) => {
  if (typeof renderPdf !== 'function') {
    throw fail(
      'STORE_DEVICE_PRINT_PDF_RENDERER_REQUIRED',
      'A certified PDF render implementation is required',
      500,
    )
  }

  return Object.freeze({
    async execute({ executionEnvelope }) {
      const envelope = assertExecutionEnvelope(executionEnvelope)
      const rendered = await renderPdf({
        documentPurpose: envelope.documentPurpose,
        source: envelope.source,
        projection: envelope.projection,
        print: envelope.print,
      })

      const buffer = assertPdfBuffer(rendered?.buffer)
      const pageCount = Number(rendered?.pageCount ?? 1)
      if (!Number.isInteger(pageCount) || pageCount <= 0) {
        throw fail(
          'STORE_DEVICE_PRINT_PDF_PAGE_COUNT_INVALID',
          'PDF renderer pageCount must be a positive integer',
          500,
        )
      }

      const checksum = crypto
        .createHash('sha256')
        .update(buffer)
        .digest('hex')

      return createPrintRenderArtifact({
        format: 'PDF',
        mediaType: 'application/pdf',
        renderer: rendererName,
        documentPurpose: envelope.documentPurpose,
        source: envelope.source,
        pageCount,
        byteLength: buffer.length,
        checksum,
        payload: Object.freeze({
          encoding: 'base64',
          data: buffer.toString('base64'),
        }),
        physicalSideEffects: false,
      })
    },
  })
}

module.exports = {
  createPdfPrintRenderService,
}
