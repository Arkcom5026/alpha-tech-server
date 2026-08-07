'use strict'

const path = require('path')
const {
  SUMATRA_PDF_TRANSPORT,
  assertSumatraPdfTransportReadiness,
} = require('./sumatraPdfCapabilityContract')

const fail = (code, message, statusCode = 400, detail = undefined) =>
  Object.assign(new Error(message), { code, statusCode, detail })

const explicitPrinterName = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw fail(
      'STORE_DEVICE_SUMATRA_PRINTER_REQUIRED',
      'Explicit printer name is required for SumatraPDF planning',
    )
  }
  return value.trim()
}

const positiveCopies = (value) => {
  const copies = Number(value)
  if (!Number.isInteger(copies) || copies <= 0 || copies > 20) {
    throw fail(
      'STORE_DEVICE_SUMATRA_COPIES_INVALID',
      'SumatraPDF copies must be an integer between 1 and 20',
    )
  }
  return copies
}

const absolutePdfPath = (value) => {
  if (typeof value !== 'string' || !value.trim() || !path.win32.isAbsolute(value.trim())) {
    throw fail(
      'STORE_DEVICE_SUMATRA_PDF_PATH_INVALID',
      'SumatraPDF requires an absolute Windows PDF artifact path',
    )
  }
  const normalized = path.win32.normalize(value.trim())
  if (path.win32.extname(normalized).toLowerCase() !== '.pdf') {
    throw fail(
      'STORE_DEVICE_SUMATRA_PDF_PATH_INVALID',
      'SumatraPDF artifact path must point to a PDF file',
    )
  }
  return normalized
}

const createBuildSumatraPdfPrintCommandService = () => Object.freeze({
  execute({ readiness, printerName, artifactFilePath, copies = 1 }) {
    const transportReadiness = assertSumatraPdfTransportReadiness(readiness)
    const printer = explicitPrinterName(printerName)
    const pdfPath = absolutePdfPath(artifactFilePath)
    const normalizedCopies = positiveCopies(copies)

    const args = [
      '-silent',
      '-print-to',
      printer,
    ]
    if (normalizedCopies > 1) {
      args.push('-print-settings', `${normalizedCopies}x`)
    }
    args.push(pdfPath)

    return Object.freeze({
      schemaVersion: 1,
      mode: 'COMMAND_PLAN_ONLY',
      physicalSideEffects: false,
      executionEnabled: false,
      transport: Object.freeze({
        code: SUMATRA_PDF_TRANSPORT.code,
        strategy: SUMATRA_PDF_TRANSPORT.strategy,
        executablePath: transportReadiness.selectedTransport.executablePath,
      }),
      printer: Object.freeze({ name: printer }),
      artifact: Object.freeze({ filePath: pdfPath, mediaType: 'application/pdf' }),
      print: Object.freeze({ copies: normalizedCopies }),
      command: Object.freeze({
        executablePath: transportReadiness.selectedTransport.executablePath,
        args: Object.freeze(args),
        shell: false,
      }),
      safety: Object.freeze({
        explicitPrinterRequired: true,
        defaultPrinterFallbackAllowed: false,
        shellExecutionAllowed: false,
        requiresExplicitPhysicalWriteApproval: true,
      }),
    })
  },
})

module.exports = {
  createBuildSumatraPdfPrintCommandService,
}
