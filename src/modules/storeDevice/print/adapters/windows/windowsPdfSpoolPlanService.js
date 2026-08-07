'use strict'

const {
  assertPrintRenderArtifact,
} = require('../../render/printRenderArtifactContract')

const fail = (code, message, statusCode = 409, detail = undefined) =>
  Object.assign(new Error(message), { code, statusCode, detail })

const positiveCopies = (value) => {
  const copies = Number(value)
  if (!Number.isInteger(copies) || copies <= 0 || copies > 20) {
    throw fail(
      'STORE_DEVICE_WINDOWS_PRINT_COPIES_INVALID',
      'Windows physical print copies must be an integer between 1 and 20',
      400,
    )
  }
  return copies
}

const createWindowsPdfSpoolPlanService = () => Object.freeze({
  execute({ admission, copies = 1 }) {
    if (
      !admission
      || admission.schemaVersion !== 1
      || admission.adapterCode !== 'WINDOWS_SPOOLER'
      || admission.mode !== 'ADMISSION_ONLY'
      || admission.admitted !== true
      || !admission.printer?.name
      || !admission.artifact
    ) {
      throw fail(
        'STORE_DEVICE_WINDOWS_PRINT_ADMISSION_REQUIRED',
        'A successful Windows print admission is required before physical planning',
      )
    }

    const artifact = assertPrintRenderArtifact(admission.artifact)
    if (artifact.format !== 'PDF' || artifact.mediaType !== 'application/pdf') {
      throw fail(
        'STORE_DEVICE_WINDOWS_PDF_ARTIFACT_REQUIRED',
        'Windows PDF spool planning requires an admitted PDF artifact',
        409,
        { format: artifact.format, mediaType: artifact.mediaType },
      )
    }

    if (
      artifact.payload?.encoding !== 'base64'
      || typeof artifact.payload?.data !== 'string'
      || !artifact.payload.data
    ) {
      throw fail(
        'STORE_DEVICE_WINDOWS_PDF_PAYLOAD_REQUIRED',
        'Admitted PDF artifact must contain base64 payload data',
      )
    }

    const normalizedCopies = positiveCopies(copies)

    return Object.freeze({
      schemaVersion: 1,
      adapterCode: 'WINDOWS_SPOOLER',
      mode: 'PHYSICAL_EXECUTION_PLAN_ONLY',
      physicalSideEffects: false,
      executionEnabled: false,
      transport: Object.freeze({
        code: 'WINDOWS_PDF_TRANSPORT_UNRESOLVED',
        ready: false,
      }),
      printer: Object.freeze({
        name: admission.printer.name,
        driverName: admission.printer.driverName || null,
        portName: admission.printer.portName || null,
      }),
      print: Object.freeze({ copies: normalizedCopies }),
      artifact: Object.freeze({
        format: artifact.format,
        mediaType: artifact.mediaType,
        renderer: artifact.renderer,
        checksum: artifact.checksum,
        byteLength: artifact.byteLength,
        pageCount: artifact.pageCount,
        payloadEncoding: artifact.payload.encoding,
      }),
      safety: Object.freeze({
        requiresExplicitTransportReadiness: true,
        requiresExplicitPhysicalWriteApproval: true,
        requiresExactPrinterMatch: true,
      }),
    })
  },
})

module.exports = {
  createWindowsPdfSpoolPlanService,
}
