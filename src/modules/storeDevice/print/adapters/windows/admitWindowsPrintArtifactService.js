'use strict'

const {
  assertPrintRenderArtifact,
} = require('../../render/printRenderArtifactContract')

const WINDOWS_ADMITTED_FORMATS = Object.freeze(['PDF', 'XPS', 'EMF'])
const ADMITTED_FORMAT_SET = new Set(WINDOWS_ADMITTED_FORMATS)

const fail = (code, message, statusCode = 409, detail = undefined) =>
  Object.assign(new Error(message), { code, statusCode, detail })

const createAdmitWindowsPrintArtifactService = () => ({
  execute({ artifact, readiness }) {
    const normalizedArtifact = assertPrintRenderArtifact(artifact)

    if (
      !readiness
      || readiness.schemaVersion !== 1
      || readiness.adapterCode !== 'WINDOWS_SPOOLER'
      || readiness.ready !== true
      || !readiness.selectedPrinter
    ) {
      throw fail(
        'STORE_DEVICE_WINDOWS_PRINT_NOT_READY',
        'Windows printer readiness must pass before artifact admission',
        409,
        { reasons: readiness?.reasons || [] },
      )
    }

    if (!ADMITTED_FORMAT_SET.has(normalizedArtifact.format)) {
      throw fail(
        'STORE_DEVICE_WINDOWS_PRINT_ARTIFACT_FORMAT_UNSUPPORTED',
        `Windows print admission does not allow ${normalizedArtifact.format}`,
        409,
        {
          format: normalizedArtifact.format,
          admittedFormats: WINDOWS_ADMITTED_FORMATS,
        },
      )
    }

    if (normalizedArtifact.physicalSideEffects === true) {
      throw fail(
        'STORE_DEVICE_WINDOWS_PRINT_ARTIFACT_SIDE_EFFECT_INVALID',
        'Render artifact must be side-effect free before Windows admission',
      )
    }

    const printer = readiness.selectedPrinter
    if (printer.isOnline !== true) {
      throw fail(
        'STORE_DEVICE_WINDOWS_PRINTER_OFFLINE',
        'Selected Windows printer is offline',
        409,
        { printerName: printer.name },
      )
    }

    return Object.freeze({
      schemaVersion: 1,
      adapterCode: 'WINDOWS_SPOOLER',
      mode: 'ADMISSION_ONLY',
      physicalSideEffects: false,
      admitted: true,
      artifact: normalizedArtifact,
      printer: Object.freeze({
        name: printer.name,
        driverName: printer.driverName || null,
        portName: printer.portName || null,
      }),
      policy: Object.freeze({
        admittedFormats: WINDOWS_ADMITTED_FORMATS,
      }),
    })
  },
})

module.exports = {
  WINDOWS_ADMITTED_FORMATS,
  createAdmitWindowsPrintArtifactService,
}
