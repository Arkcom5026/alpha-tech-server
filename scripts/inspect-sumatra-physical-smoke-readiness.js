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

const valueOf = (name) => {
  const prefix = `--${name}=`
  const arg = process.argv.slice(2).find((entry) => entry.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : null
}

const printerName = valueOf('printer')
const artifactArg = valueOf('artifact')
const copiesArg = valueOf('copies')

if (!printerName) {
  console.error('SUMATRA_PHYSICAL_SMOKE_READINESS_FAILED')
  console.error('Error: --printer=<exact Windows printer name> is required')
  process.exit(2)
}

const artifactFilePath = path.resolve(
  artifactArg || path.join('.tmp-print-artifacts', 'windows-browser-thai-smoke.pdf'),
)
const copies = copiesArg == null ? 1 : Number(copiesArg)

try {
  const discoverySnapshot = collectWindowsPrintDiscoverySnapshot({
    selectedPrinterName: printerName,
  })
  const printerReadiness = createInspectWindowsPrintAdapterReadinessService()
    .execute({ discoverySnapshot })
  const transportReadiness = createInspectWindowsPdfTransportReadinessService().execute()

  const report = createPrepareSumatraPdfPhysicalSmokeService().execute({
    transportReadiness,
    printerReadiness,
    artifactFilePath,
    printerName,
    copies,
  })

  console.log(JSON.stringify({
    mode: 'READ_ONLY_SUMATRA_PHYSICAL_SMOKE_READINESS',
    physicalSideEffects: false,
    targetPrinter: printerName,
    artifactFilePath,
    report,
  }, null, 2))
} catch (error) {
  console.error('SUMATRA_PHYSICAL_SMOKE_READINESS_FAILED')
  console.error(error)
  process.exitCode = 2
}
