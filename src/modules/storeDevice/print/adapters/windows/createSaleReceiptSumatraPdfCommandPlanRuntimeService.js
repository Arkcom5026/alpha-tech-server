'use strict'

const {
  assertExecutionEnvelope,
} = require('../../printExecutionAdapterContract')
const {
  createSaleReceiptWindowsPdfSpoolPlanRuntimeService,
} = require('./createSaleReceiptWindowsPdfSpoolPlanRuntimeService')
const {
  createStageWindowsPdfPrintArtifactService,
} = require('./stageWindowsPdfPrintArtifactService')
const {
  createInspectWindowsPdfTransportReadinessService,
} = require('./inspectWindowsPdfTransportReadinessService')
const {
  createBuildSumatraPdfPrintCommandService,
} = require('./buildSumatraPdfPrintCommandService')

const fail = (code, message, statusCode = 409, detail = undefined) =>
  Object.assign(new Error(message), { code, statusCode, detail })

const createSaleReceiptSumatraPdfCommandPlanRuntimeService = ({
  spoolPlanRuntimeService = createSaleReceiptWindowsPdfSpoolPlanRuntimeService(),
  stagingService = createStageWindowsPdfPrintArtifactService(),
  transportReadinessService = createInspectWindowsPdfTransportReadinessService(),
  commandPlanService = createBuildSumatraPdfPrintCommandService(),
} = {}) => Object.freeze({
  async execute({ executionEnvelope, readiness }) {
    const envelope = assertExecutionEnvelope(executionEnvelope)

    const planned = await spoolPlanRuntimeService.execute({
      executionEnvelope: envelope,
      readiness,
    })

    const staged = await stagingService.execute({
      artifact: planned.render.artifact,
    })

    if (
      staged?.artifact?.checksum !== planned.spoolPlan?.artifact?.checksum
      || staged?.artifact?.mediaType !== 'application/pdf'
      || typeof staged?.artifact?.filePath !== 'string'
      || !staged.artifact.filePath.trim()
    ) {
      throw fail(
        'STORE_DEVICE_SALE_RECEIPT_STAGED_PDF_MISMATCH',
        'Staged Sale Receipt PDF must match the certified spool plan artifact',
        409,
        {
          plannedChecksum: planned.spoolPlan?.artifact?.checksum || null,
          stagedChecksum: staged?.artifact?.checksum || null,
        },
      )
    }

    const transportReadiness = transportReadinessService.execute()
    const commandPlan = commandPlanService.execute({
      readiness: transportReadiness,
      printerName: planned.spoolPlan.printer.name,
      artifactFilePath: staged.artifact.filePath,
      copies: planned.spoolPlan.print.copies,
    })

    return Object.freeze({
      schemaVersion: 1,
      mode: 'SALE_RECEIPT_SUMATRA_PDF_COMMAND_PLAN',
      physicalSideEffects: false,
      filesystemSideEffects: true,
      executionEnabled: false,
      documentPurpose: Object.freeze({
        code: envelope.documentPurpose.code,
      }),
      source: Object.freeze({
        type: envelope.source.type,
        id: Number(envelope.source.id),
      }),
      spoolPlanning: planned,
      staging: staged,
      transportReadiness,
      commandPlan,
      safety: Object.freeze({
        artifactChecksumBoundToPlan: true,
        explicitPrinterBoundToPlan: true,
        transportReadinessVerified: true,
        processExecutionPerformed: false,
        spoolSubmissionPerformed: false,
        requiresExplicitPhysicalAuthorization: true,
        requiresDedicatedPhysicalExecutor: true,
      }),
    })
  },
})

module.exports = {
  createSaleReceiptSumatraPdfCommandPlanRuntimeService,
}
