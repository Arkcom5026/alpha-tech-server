'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  SUMATRA_PDF_TRANSPORT,
  assertSumatraPdfTransportReadiness,
} = require('../src/modules/storeDevice/print/adapters/windows/sumatraPdfCapabilityContract')

assert.strictEqual(SUMATRA_PDF_TRANSPORT.code, 'SUMATRA_PDF')
assert.strictEqual(SUMATRA_PDF_TRANSPORT.strategy, 'EXPLICIT_PRINTER_CLI')
assert.strictEqual(SUMATRA_PDF_TRANSPORT.supportsExplicitPrinterSelection, true)
assert.strictEqual(SUMATRA_PDF_TRANSPORT.supportsSilentPrint, true)
assert.strictEqual(SUMATRA_PDF_TRANSPORT.supportsCopies, true)
assert.strictEqual(SUMATRA_PDF_TRANSPORT.supportsDefaultPrinterFallback, false)
assert.strictEqual(SUMATRA_PDF_TRANSPORT.supportsShellExecution, false)
assert.strictEqual(SUMATRA_PDF_TRANSPORT.requiresAbsoluteArtifactPath, true)
assert.strictEqual(SUMATRA_PDF_TRANSPORT.requiresExplicitPhysicalWriteApproval, true)

const readiness = Object.freeze({
  schemaVersion: 1,
  mode: 'DISCOVERY_ONLY',
  ready: true,
  selectedTransport: Object.freeze({
    code: 'SUMATRA_PDF',
    strategy: 'EXPLICIT_PRINTER_CLI',
    executablePath: 'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe',
  }),
})
assert.strictEqual(assertSumatraPdfTransportReadiness(readiness), readiness)
assert.throws(
  () => assertSumatraPdfTransportReadiness({ ...readiness, ready: false }),
  (error) => error.code === 'STORE_DEVICE_SUMATRA_PDF_TRANSPORT_NOT_READY',
)

const source = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'modules', 'storeDevice', 'print', 'adapters', 'windows', 'sumatraPdfCapabilityContract.js'),
  'utf8',
)
assert.doesNotMatch(source, /child_process|exec\(|execFile\(|spawn\(|Start-Process|WinSpool|prisma/i)

console.log('store-device-sumatra-pdf-capability.contract.test.js: PASS')
