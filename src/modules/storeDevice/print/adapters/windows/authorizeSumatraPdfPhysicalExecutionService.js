'use strict'

const APPROVAL_TOKEN = 'ALPHATECH_SUMATRA_PDF_PHYSICAL_PRINT'

const fail = (code, message, statusCode = 409, detail = undefined) =>
  Object.assign(new Error(message), { code, statusCode, detail })

const assertCommandPlan = (plan) => {
  if (
    !plan
    || plan.schemaVersion !== 1
    || plan.mode !== 'COMMAND_PLAN_ONLY'
    || plan.physicalSideEffects !== false
    || plan.executionEnabled !== false
    || plan.transport?.code !== 'SUMATRA_PDF'
    || plan.transport?.strategy !== 'EXPLICIT_PRINTER_CLI'
    || typeof plan.command?.executablePath !== 'string'
    || !plan.command.executablePath.trim()
    || !Array.isArray(plan.command?.args)
    || plan.command.shell !== false
    || typeof plan.printer?.name !== 'string'
    || !plan.printer.name.trim()
    || typeof plan.artifact?.filePath !== 'string'
    || !plan.artifact.filePath.trim()
  ) {
    throw fail(
      'STORE_DEVICE_SUMATRA_COMMAND_PLAN_REQUIRED',
      'Certified SumatraPDF command plan is required before physical authorization',
    )
  }

  return plan
}

const createAuthorizeSumatraPdfPhysicalExecutionService = () => Object.freeze({
  execute({ commandPlan, approvalToken, expectedPrinterName }) {
    const plan = assertCommandPlan(commandPlan)

    if (approvalToken !== APPROVAL_TOKEN) {
      throw fail(
        'STORE_DEVICE_SUMATRA_PHYSICAL_APPROVAL_REQUIRED',
        'Explicit physical print approval is required',
        403,
      )
    }

    if (
      typeof expectedPrinterName !== 'string'
      || !expectedPrinterName.trim()
      || expectedPrinterName.trim() !== plan.printer.name
    ) {
      throw fail(
        'STORE_DEVICE_SUMATRA_PRINTER_AUTHORITY_MISMATCH',
        'Authorized printer must exactly match the certified command plan printer',
        409,
        {
          expectedPrinterName: expectedPrinterName || null,
          plannedPrinterName: plan.printer.name,
        },
      )
    }

    return Object.freeze({
      schemaVersion: 1,
      mode: 'PHYSICAL_EXECUTION_AUTHORIZED',
      physicalSideEffects: false,
      executionEnabled: false,
      transport: Object.freeze({ ...plan.transport }),
      printer: Object.freeze({ name: plan.printer.name }),
      artifact: Object.freeze({ ...plan.artifact }),
      print: Object.freeze({ ...plan.print }),
      command: Object.freeze({
        executablePath: plan.command.executablePath,
        args: Object.freeze([...plan.command.args]),
        shell: false,
      }),
      authorization: Object.freeze({
        explicitApprovalVerified: true,
        exactPrinterMatchVerified: true,
        executorRequired: true,
      }),
      safety: Object.freeze({
        processExecutionPerformed: false,
        spoolSubmissionPerformed: false,
        requiresDedicatedPhysicalExecutor: true,
      }),
    })
  },
})

module.exports = {
  APPROVAL_TOKEN,
  createAuthorizeSumatraPdfPhysicalExecutionService,
}
