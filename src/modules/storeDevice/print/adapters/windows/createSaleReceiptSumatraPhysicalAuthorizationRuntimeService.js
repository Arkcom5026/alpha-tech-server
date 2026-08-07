'use strict'

const {
  assertExecutionEnvelope,
} = require('../../printExecutionAdapterContract')
const {
  createSaleReceiptSumatraPdfCommandPlanRuntimeService,
} = require('./createSaleReceiptSumatraPdfCommandPlanRuntimeService')
const {
  createAuthorizeSumatraPdfPhysicalExecutionService,
} = require('./authorizeSumatraPdfPhysicalExecutionService')

const fail = (code, message, statusCode = 409, detail = undefined) =>
  Object.assign(new Error(message), { code, statusCode, detail })

const createSaleReceiptSumatraPhysicalAuthorizationRuntimeService = ({
  commandPlanRuntimeService = createSaleReceiptSumatraPdfCommandPlanRuntimeService(),
  authorizationService = createAuthorizeSumatraPdfPhysicalExecutionService(),
} = {}) => Object.freeze({
  async execute({ executionEnvelope, readiness, approvalToken, expectedPrinterName }) {
    const envelope = assertExecutionEnvelope(executionEnvelope)

    const planned = await commandPlanRuntimeService.execute({
      executionEnvelope: envelope,
      readiness,
    })

    const plannedPrinterName = planned?.commandPlan?.printer?.name
    if (
      typeof plannedPrinterName !== 'string'
      || !plannedPrinterName.trim()
      || plannedPrinterName !== planned?.spoolPlanning?.spoolPlan?.printer?.name
    ) {
      throw fail(
        'STORE_DEVICE_SALE_RECEIPT_SUMATRA_PRINTER_PLAN_MISMATCH',
        'Sale Receipt Sumatra command plan printer must match the certified spool plan printer',
        409,
        {
          plannedPrinterName: plannedPrinterName || null,
          spoolPlanPrinterName: planned?.spoolPlanning?.spoolPlan?.printer?.name || null,
        },
      )
    }

    const authorization = authorizationService.execute({
      commandPlan: planned.commandPlan,
      approvalToken,
      expectedPrinterName,
    })

    if (
      authorization?.mode !== 'PHYSICAL_EXECUTION_AUTHORIZED'
      || authorization?.physicalSideEffects !== false
      || authorization?.executionEnabled !== false
      || authorization?.printer?.name !== plannedPrinterName
      || authorization?.authorization?.explicitApprovalVerified !== true
      || authorization?.authorization?.exactPrinterMatchVerified !== true
      || authorization?.authorization?.executorRequired !== true
    ) {
      throw fail(
        'STORE_DEVICE_SALE_RECEIPT_SUMATRA_AUTHORIZATION_INVALID',
        'Sale Receipt Sumatra physical authorization is invalid',
        409,
      )
    }

    return Object.freeze({
      schemaVersion: 1,
      mode: 'SALE_RECEIPT_SUMATRA_PHYSICAL_AUTHORIZED',
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
      planning: planned,
      authorization,
      safety: Object.freeze({
        artifactChecksumBoundToPlan: true,
        exactPrinterMatchVerified: true,
        explicitApprovalVerified: true,
        processExecutionPerformed: false,
        spoolSubmissionPerformed: false,
        requiresDedicatedPhysicalExecutor: true,
      }),
    })
  },
})

module.exports = {
  createSaleReceiptSumatraPhysicalAuthorizationRuntimeService,
}
