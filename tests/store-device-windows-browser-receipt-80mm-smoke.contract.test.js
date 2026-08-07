'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const sourcePath = path.resolve('scripts/render-windows-browser-receipt-80mm-smoke.js')
const source = fs.readFileSync(sourcePath, 'utf8')

assert.match(source, /@page \{ size: 80mm 120mm; margin: 4mm; \}/)
assert.match(source, /windows-browser-thai-receipt-80mm-smoke\.pdf/)
assert.match(source, /LOCAL_GATEWAY_BROWSER_RECEIPT_80MM_PDF_SMOKE/)
assert.match(source, /EPSON TM-T82X Receipt/)
assert.match(source, /ทดสอบเครื่องพิมพ์ใบเสร็จ 80 มม\./)
assert.match(source, /ไม่ใช่ใบเสร็จจริง/)
assert.doesNotMatch(source, /print-to|Start-Process|WinSpool|Remove-PrintJob|ALPHATECH_SUMATRA_PHYSICAL_PRINT_APPROVAL/)

console.log('store-device-windows-browser-receipt-80mm-smoke.contract.test.js: PASS')
