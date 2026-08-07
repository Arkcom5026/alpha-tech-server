'use strict'

const {
  createInspectWindowsBrowserPdfRendererReadinessService,
} = require('../src/modules/storeDevice/print/render/inspectWindowsBrowserPdfRendererReadinessService')

const report = createInspectWindowsBrowserPdfRendererReadinessService().execute()

console.log(JSON.stringify(report, null, 2))

if (!report.ready) {
  process.exitCode = 2
}
