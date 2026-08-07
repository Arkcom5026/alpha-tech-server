'use strict'

const SUMATRA_PDF_TRANSPORT = Object.freeze({
  schemaVersion: 1,
  code: 'SUMATRA_PDF',
  strategy: 'EXPLICIT_PRINTER_CLI',
  mediaTypes: Object.freeze(['application/pdf']),
  supportsExplicitPrinterSelection: true,
  supportsSilentPrint: true,
  supportsCopies: true,
  supportsDefaultPrinterFallback: false,
  supportsShellExecution: false,
  requiresAbsoluteArtifactPath: true,
  requiresExplicitPhysicalWriteApproval: true,
})

const fail = (code, message, statusCode = 409) =>
  Object.assign(new Error(message), { code, statusCode })

const assertSumatraPdfTransportReadiness = (readiness) => {
  if (
    !readiness
    || readiness.schemaVersion !== 1
    || readiness.mode !== 'DISCOVERY_ONLY'
    || readiness.ready !== true
    || readiness.selectedTransport?.code !== SUMATRA_PDF_TRANSPORT.code
    || readiness.selectedTransport?.strategy !== SUMATRA_PDF_TRANSPORT.strategy
    || typeof readiness.selectedTransport?.executablePath !== 'string'
    || !readiness.selectedTransport.executablePath.trim()
  ) {
    throw fail(
      'STORE_DEVICE_SUMATRA_PDF_TRANSPORT_NOT_READY',
      'Certified SumatraPDF transport readiness is required',
    )
  }

  return readiness
}

module.exports = {
  SUMATRA_PDF_TRANSPORT,
  assertSumatraPdfTransportReadiness,
}
