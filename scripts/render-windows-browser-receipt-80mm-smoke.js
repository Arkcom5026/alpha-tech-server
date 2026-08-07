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
const outputPath = path.join(outDir, 'windows-browser-thai-receipt-80mm-smoke.pdf')

const html = `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<title>Alpha-Tech 80mm Receipt Smoke</title>
<style>
  @page { size: 80mm 120mm; margin: 4mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; width: 72mm; }
  body {
    font-family: "Leelawadee UI", "Tahoma", sans-serif;
    font-size: 10.5pt;
    line-height: 1.35;
    color: #000;
  }
  .center { text-align: center; }
  .title { font-size: 14pt; font-weight: 700; margin-bottom: 1mm; }
  .rule { border-top: 1px dashed #000; margin: 2mm 0; }
  .row { display: flex; justify-content: space-between; gap: 2mm; }
  .total { font-size: 12pt; font-weight: 700; }
  .small { font-size: 8.5pt; }
</style>
</head>
<body>
  <div class="center title">ALPHA-TECH</div>
  <div class="center">ทดสอบเครื่องพิมพ์ใบเสร็จ 80 มม.</div>
  <div class="center small">EPSON TM-T82X Receipt</div>
  <div class="rule"></div>
  <div>รายการทดสอบภาษาไทย</div>
  <div class="row"><span>สินค้า A x 1</span><span>1,000.00</span></div>
  <div class="row"><span>สินค้า B x 1</span><span>234.56</span></div>
  <div class="rule"></div>
  <div class="row total"><span>ยอดรวม</span><span>1,234.56 บาท</span></div>
  <div class="rule"></div>
  <div class="center small">เอกสารทดสอบระบบพิมพ์ Alpha-Tech</div>
  <div class="center small">*** ไม่ใช่ใบเสร็จจริง ***</div>
</body>
</html>`

const result = createWindowsBrowserPdfTransport().execute({
  browserExecutablePath: readiness.selectedRenderer.executablePath,
  html,
  outputPath,
})

console.log(JSON.stringify({
  mode: 'LOCAL_GATEWAY_BROWSER_RECEIPT_80MM_PDF_SMOKE',
  physicalSideEffects: false,
  paper: Object.freeze({ widthMm: 80, heightMm: 120, marginMm: 4 }),
  selectedRenderer: readiness.selectedRenderer,
  outputPath: result.outputPath,
  byteLength: result.pdfBytes.length,
  pdfHeader: result.pdfBytes.subarray(0, 5).toString('ascii'),
}, null, 2))
