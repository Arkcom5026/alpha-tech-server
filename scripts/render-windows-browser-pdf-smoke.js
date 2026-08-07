'use strict'

const fs = require('fs')
const path = require('path')
const {
  createInspectWindowsBrowserPdfRendererReadinessService,
} = require('../src/modules/storeDevice/print/render/inspectWindowsBrowserPdfRendererReadinessService')
const {
  createWindowsBrowserPdfTransport,
} = require('../src/modules/storeDevice/print/render/windowsBrowserPdfTransport')

const readiness = createInspectWindowsBrowserPdfRendererReadinessService().execute()

if (!readiness.ready || !readiness.selectedRenderer?.executablePath) {
  console.error(JSON.stringify(readiness, null, 2))
  process.exit(2)
}

const outDir = path.resolve('.tmp-print-artifacts')
fs.mkdirSync(outDir, { recursive: true })
const outputPath = path.join(outDir, 'windows-browser-thai-smoke.pdf')

const html = `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<title>Alpha-Tech Print Smoke</title>
<style>
  @page { size: A4; margin: 16mm; }
  body { font-family: "Leelawadee UI", "Tahoma", sans-serif; font-size: 14px; line-height: 1.5; }
  h1 { font-size: 22px; margin: 0 0 12px; }
  .box { border: 1px solid #222; padding: 12px; }
</style>
</head>
<body>
  <h1>ทดสอบการสร้าง PDF ภาษาไทย</h1>
  <div class="box">
    <div>บริษัท แอดวานซ์ เทค บรรพต จำกัด</div>
    <div>เอกสารทดสอบระบบพิมพ์ Alpha-Tech</div>
    <div>ยอดรวม 1,234.56 บาท</div>
  </div>
</body>
</html>`

const result = createWindowsBrowserPdfTransport().execute({
  browserExecutablePath: readiness.selectedRenderer.executablePath,
  html,
  outputPath,
})

console.log(JSON.stringify({
  mode: 'LOCAL_GATEWAY_BROWSER_PDF_SMOKE',
  physicalSideEffects: false,
  selectedRenderer: readiness.selectedRenderer,
  outputPath: result.outputPath,
  byteLength: result.pdfBytes.length,
  pdfHeader: result.pdfBytes.subarray(0, 5).toString('ascii'),
}, null, 2))
