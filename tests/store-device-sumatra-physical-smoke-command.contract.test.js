'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const scriptPath = path.join(
  __dirname,
  '..',
  'scripts',
  'inspect-sumatra-physical-smoke-readiness.js',
)
const source = fs.readFileSync(scriptPath, 'utf8')

assert.match(source, /--printer=/)
assert.match(source, /windows-browser-thai-smoke\.pdf/)
assert.match(source, /collectWindowsPrintDiscoverySnapshot/)
assert.match(source, /createInspectWindowsPrintAdapterReadinessService/)
assert.match(source, /createInspectWindowsPdfTransportReadinessService/)
assert.match(source, /createPrepareSumatraPdfPhysicalSmokeService/)
assert.match(source, /READ_ONLY_SUMATRA_PHYSICAL_SMOKE_READINESS/)
assert.match(source, /physicalSideEffects:\s*false/)

assert.doesNotMatch(
  source,
  /executeAuthorizedSumatraPdfPhysicalPrintService|authorizeSumatraPdfPhysicalExecutionService|ALPHATECH_SUMATRA_PDF_PHYSICAL_PRINT|execFile\(|spawn\(|Start-Process|WinSpool/i,
)

console.log('store-device-sumatra-physical-smoke-command.contract.test.js: PASS')
