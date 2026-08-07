'use strict'

const {
  createInspectWindowsPdfTransportReadinessService,
} = require('../src/modules/storeDevice/print/adapters/windows/inspectWindowsPdfTransportReadinessService')

const report = createInspectWindowsPdfTransportReadinessService().execute()

console.log(JSON.stringify(report, null, 2))
process.exitCode = report.ready ? 0 : 2
