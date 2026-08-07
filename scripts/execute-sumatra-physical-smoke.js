'use strict'

const path = require('path')
const {
  collectWindowsPrintDiscoverySnapshot,
} = require('../src/modules/storeDevice/print/adapters/windows/collectWindowsPrintDiscoverySnapshot')
const {
  createInspectWindowsPrintAdapterReadinessService,
} = require('../src/modules/storeDevice/print/adapters/windows/inspectWindowsPrintAdapterReadinessService')
const {
  createInspectWindowsPdfTransportReadinessService,
} = require('../src/modules/storeDevice/print/adapters/windows/inspectWindowsPdfTransportReadinessService')
const {
  createPrepareSumatraPdfPhysicalSmokeService,
} = require('../src/modules/storeDevice/print/adapters/windows/prepareSumatraPdfPhysicalSmokeService')
const {
  APPROVAL_TOKEN,
  createAuthorizeSumatraPdfPhysicalExecutionService,
} = require('../src/modules/storeDevice/print/adapters/windows/authorizeSumatraPdfPhysicalExecutionService')
const {
  createExecuteAuthorizedSumatraPdfPhysicalPrintService,
} = require('../src/modules/storeDevice/print/adapters/windows/executeAuthorizedSumatraPdfPhysicalPrintService')

const valueOf = (name) => {
  const prefix = `--${name}=`
  const arg = process.argv.slice(2).find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : null
}

const printerName = valueOf('printer')
const artifactArg = valueOf('artifact')
const copiesArg = valueOf('copies')
const approval = process.env.ALPHATECH_SUMATRA_PHYSICAL_PRINT_APPROVAL

if (!printerName) {
  console.error('SUMATRA_PHYSICAL_SMOKE_EXECUTION_FAILED')
  console.error('Error: --printer=<exact Windows printer name> is required')
  process.exit(2)
}

if (approval !== APPROVAL_TOKEN) {
  console.error('SUMATRA_PHYSICAL_SMOKE_EXECUTION_FAILED')
  console.error('Error: explicit physical print approval environment variable is required')
  process.exit(3)
}

const artifactFilePath = path.resolve(
  artifactArg || path.join('.tmp-print-artifacts', 'windows-browser-thai-smoke.pdf'),
)
const copies = copiesArg == null ? 1 : Number(copiesArg)

async function main() {
  const discoverySnapshot = collectWindowsPrintDiscoverySnapshot({
    selectedPrinterName: printerName,
  })
  const printerReadiness = createInspectWindowsPrintAdapterReadinessService()
    .execute({ discoverySnapshot })
  const transportReadiness = createInspectWindowsPdfTransportReadinessService().execute()

  const readiness = createPrepareSumatraPdfPhysicalSmokeService().execute({
    transportReadiness,
    printerReadiness,
    artifactFilePath,
    printerName,
    copies,
  })

  const authorization = createAuthorizeSumatraPdfPhysicalExecutionService().execute({
    commandPlan: readiness.commandPlan,
    approvalToken: approval,
    expectedPrinterName: printerName,
  })

  console.log(JSON.stringify({
    mode: 'SUMATRA_PHYSICAL_SMOKE_EXECUTION_AUTHORIZED',
    targetPrinter: printerName,
    artifactFilePath,
    copies,
    readiness: {
      ready: readiness.ready,
      printer: readiness.printer,
      artifact: readiness.artifact,
      transport: readiness.commandPlan.transport,
    },
    authorization: authorization.authorization,
  }, null, 2))

  const result = await createExecuteAuthorizedSumatraPdfPhysicalPrintService().execute({
    authorization,
  })

  console.log(JSON.stringify({
    mode: 'SUMATRA_PHYSICAL_SMOKE_EXECUTION_RESULT',
    result,
  }, null, 2))
}

main().catch((error) => {
  console.error('SUMATRA_PHYSICAL_SMOKE_EXECUTION_FAILED')
  console.error(error)
  process.exitCode = 1
})
