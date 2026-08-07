'use strict'

const fs = require('fs')
const path = require('path')
const {
  createBuildSumatraPdfPrintCommandService,
} = require('./buildSumatraPdfPrintCommandService')

const fail = (code, message, statusCode = 409, detail = undefined) =>
  Object.assign(new Error(message), { code, statusCode, detail })

const createPrepareSumatraPdfPhysicalSmokeService = ({
  existsSync = fs.existsSync,
  readFileSync = fs.readFileSync,
  commandBuilder = createBuildSumatraPdfPrintCommandService(),
} = {}) => Object.freeze({
  execute({ transportReadiness, printerReadiness, artifactFilePath, printerName, copies = 1 }) {
    if (
      !printerReadiness
      || printerReadiness.schemaVersion !== 1
      || printerReadiness.adapterCode !== 'WINDOWS_SPOOLER'
      || printerReadiness.mode !== 'DISCOVERY_ONLY'
      || printerReadiness.ready !== true
      || !printerReadiness.selectedPrinter?.name
    ) {
      throw fail(
        'STORE_DEVICE_SUMATRA_PHYSICAL_SMOKE_PRINTER_NOT_READY',
        'Certified Windows printer readiness is required before physical smoke planning',
      )
    }

    const explicitPrinter = String(printerName || '').trim()
    if (!explicitPrinter || explicitPrinter !== printerReadiness.selectedPrinter.name) {
      throw fail(
        'STORE_DEVICE_SUMATRA_PHYSICAL_SMOKE_PRINTER_MISMATCH',
        'Explicit physical smoke printer must exactly match Windows readiness',
        409,
        {
          expectedPrinterName: explicitPrinter || null,
          readyPrinterName: printerReadiness.selectedPrinter.name,
        },
      )
    }

    const absolutePath = path.win32.normalize(String(artifactFilePath || '').trim())
    if (!path.win32.isAbsolute(absolutePath) || path.win32.extname(absolutePath).toLowerCase() !== '.pdf') {
      throw fail(
        'STORE_DEVICE_SUMATRA_PHYSICAL_SMOKE_ARTIFACT_INVALID',
        'Physical smoke planning requires an absolute PDF artifact path',
      )
    }

    if (!existsSync(absolutePath)) {
      throw fail(
        'STORE_DEVICE_SUMATRA_PHYSICAL_SMOKE_ARTIFACT_NOT_FOUND',
        'Physical smoke PDF artifact does not exist',
        409,
        { artifactFilePath: absolutePath },
      )
    }

    const header = Buffer.from(readFileSync(absolutePath)).subarray(0, 5).toString('ascii')
    if (header !== '%PDF-') {
      throw fail(
        'STORE_DEVICE_SUMATRA_PHYSICAL_SMOKE_ARTIFACT_INVALID',
        'Physical smoke artifact is not a certified PDF file',
      )
    }

    const commandPlan = commandBuilder.execute({
      readiness: transportReadiness,
      printerName: explicitPrinter,
      artifactFilePath: absolutePath,
      copies,
    })

    return Object.freeze({
      schemaVersion: 1,
      mode: 'PHYSICAL_SMOKE_READY_FOR_EXPLICIT_APPROVAL',
      physicalSideEffects: false,
      executionEnabled: false,
      ready: true,
      printer: Object.freeze({ ...printerReadiness.selectedPrinter }),
      artifact: Object.freeze({ filePath: absolutePath, pdfHeader: header }),
      commandPlan,
      authorization: Object.freeze({
        approvalRequired: true,
        approvalTokenEmbedded: false,
        executionPerformed: false,
      }),
    })
  },
})

module.exports = {
  createPrepareSumatraPdfPhysicalSmokeService,
}
