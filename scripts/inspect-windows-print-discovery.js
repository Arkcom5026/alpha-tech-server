'use strict'

const {
  collectWindowsPrintDiscoverySnapshot,
} = require('../src/modules/storeDevice/print/adapters/windows/collectWindowsPrintDiscoverySnapshot')
const {
  createInspectWindowsPrintAdapterReadinessService,
} = require('../src/modules/storeDevice/print/adapters/windows/inspectWindowsPrintAdapterReadinessService')

const selectedPrinterArg = process.argv.find((arg) => arg.startsWith('--printer='))
const selectedPrinterName = selectedPrinterArg
  ? selectedPrinterArg.slice('--printer='.length).trim() || null
  : null

try {
  const discoverySnapshot = collectWindowsPrintDiscoverySnapshot({
    selectedPrinterName,
  })

  const readiness = createInspectWindowsPrintAdapterReadinessService().execute({
    discoverySnapshot,
  })

  console.log(JSON.stringify({
    mode: 'READ_ONLY_WINDOWS_PRINT_DISCOVERY',
    physicalSideEffects: false,
    discoverySnapshot,
    readiness,
  }, null, 2))

  process.exitCode = readiness.ready ? 0 : 2
} catch (error) {
  console.error('WINDOWS_PRINT_DISCOVERY_FAILED')
  console.error(error)
  process.exitCode = 1
}
