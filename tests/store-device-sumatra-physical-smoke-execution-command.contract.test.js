'use strict'

const assert = require('assert')
const fs = require('fs')

const source = fs.readFileSync(
  'scripts/execute-sumatra-physical-smoke.js',
  'utf8',
)

assert.match(source, /ALPHATECH_SUMATRA_PHYSICAL_PRINT_APPROVAL/)
assert.match(source, /APPROVAL_TOKEN/)
assert.match(source, /--printer=/)
assert.match(source, /createPrepareSumatraPdfPhysicalSmokeService/)
assert.match(source, /createAuthorizeSumatraPdfPhysicalExecutionService/)
assert.match(source, /createExecuteAuthorizedSumatraPdfPhysicalPrintService/)
assert.match(source, /expectedPrinterName:\s*printerName/)
assert.match(source, /copiesArg == null \? 1/)
assert.match(source, /SUMATRA_PHYSICAL_SMOKE_EXECUTION_AUTHORIZED/)
assert.match(source, /SUMATRA_PHYSICAL_SMOKE_EXECUTION_RESULT/)
assert.doesNotMatch(source, /EPSON L3210 Series/)

console.log('store-device-sumatra-physical-smoke-execution-command.contract.test.js: PASS')
