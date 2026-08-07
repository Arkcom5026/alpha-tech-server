'use strict'

const {
  assertExecutionEnvelope,
} = require('../../printExecutionAdapterContract')
const {
  createStoreDevicePrintRenderRuntimeService,
} = require('../../render/createStoreDevicePrintRenderRuntimeService')
const {
  createAdmitWindowsPrintArtifactService,
} = require('./admitWindowsPrintArtifactService')
const {
  createWindowsPdfSpoolPlanService,
} = require('./windowsPdfSpoolPlanService')

const createSaleReceiptWindowsPdfSpoolPlanRuntimeService = ({
  renderRuntimeService = createStoreDevicePrintRenderRuntimeService(),
  admissionService = createAdmitWindowsPrintArtifactService(),
  spoolPlanService = createWindowsPdfSpoolPlanService(),
} = {}) => Object.freeze({
  async execute({ executionEnvelope, readiness }) {
    const envelope = assertExecutionEnvelope(executionEnvelope)

    const rendered = await renderRuntimeService.render({
      executionEnvelope: envelope,
    })

    const admission = admissionService.execute({
      artifact: rendered.artifact,
      readiness,
    })

    const spoolPlan = spoolPlanService.execute({
      admission,
      copies: Number(envelope.print.copies),
    })

    return Object.freeze({
      schemaVersion: 1,
      mode: 'SALE_RECEIPT_WINDOWS_PDF_SPOOL_PLAN',
      physicalSideEffects: false,
      executionEnabled: false,
      documentPurpose: Object.freeze({
        code: envelope.documentPurpose.code,
      }),
      source: Object.freeze({
        type: envelope.source.type,
        id: Number(envelope.source.id),
      }),
      render: Object.freeze({
        purposeCode: rendered.purposeCode,
        format: rendered.format,
        artifact: rendered.artifact,
      }),
      admission,
      spoolPlan,
      safety: Object.freeze({
        artifactRenderedOnly: true,
        windowsAdmissionOnly: true,
        physicalExecutionPerformed: false,
        artifactPersistencePerformed: false,
        requiresArtifactPersistence: true,
        requiresTransportReadiness: true,
        requiresExplicitPhysicalAuthorization: true,
        requiresDedicatedPhysicalExecutor: true,
      }),
    })
  },
})

module.exports = {
  createSaleReceiptWindowsPdfSpoolPlanRuntimeService,
}
