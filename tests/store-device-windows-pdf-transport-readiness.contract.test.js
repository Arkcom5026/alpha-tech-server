'use strict'

const assert = require('assert')
const {
  createInspectWindowsPdfTransportReadinessService,
} = require('../src/modules/storeDevice/print/adapters/windows/inspectWindowsPdfTransportReadinessService')

const env = {
  LOCALAPPDATA: 'C:\\Users\\Test\\AppData\\Local',
  PROGRAMFILES: 'C:\\Program Files',
  'PROGRAMFILES(X86)': 'C:\\Program Files (x86)',
}

const sumatraPath = 'C:\\Users\\Test\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe'
const configuredSumatraPath = 'D:\\alpha-tech\\tools\\SumatraPDF\\SumatraPDF.exe'
const adobePath = 'C:\\Program Files\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe'

const ready = createInspectWindowsPdfTransportReadinessService({
  env,
  platform: 'win32',
  existsSync: (candidate) => candidate === sumatraPath,
}).execute()

assert.strictEqual(ready.ready, true)
assert.deepStrictEqual(ready.reasons, [])
assert.strictEqual(ready.selectedTransport.code, 'SUMATRA_PDF')
assert.strictEqual(ready.selectedTransport.strategy, 'EXPLICIT_PRINTER_CLI')
assert.strictEqual(ready.selectedTransport.executablePath, sumatraPath)
assert.strictEqual(ready.selectedTransport.source, 'STANDARD_LOCATION')
assert.strictEqual(ready.physicalSideEffects, false)
assert.strictEqual(ready.policy.executionEnabled, false)
assert.strictEqual(ready.policy.requiresExplicitPrinterTarget, true)
assert.strictEqual(ready.policy.explicitPathEnvironmentVariable, 'SUMATRA_PDF_PATH')

const configured = createInspectWindowsPdfTransportReadinessService({
  env: { ...env, SUMATRA_PDF_PATH: configuredSumatraPath },
  platform: 'win32',
  existsSync: (candidate) => candidate === configuredSumatraPath,
}).execute()

assert.strictEqual(configured.ready, true)
assert.strictEqual(configured.selectedTransport.code, 'SUMATRA_PDF')
assert.strictEqual(configured.selectedTransport.executablePath, configuredSumatraPath)
assert.strictEqual(configured.selectedTransport.source, 'EXPLICIT_CONFIG')
assert.strictEqual(configured.candidates[0].locations[0].configured, true)

const configuredMissing = createInspectWindowsPdfTransportReadinessService({
  env: { ...env, SUMATRA_PDF_PATH: configuredSumatraPath },
  platform: 'win32',
  existsSync: () => false,
}).execute()

assert.strictEqual(configuredMissing.ready, false)
assert.deepStrictEqual(configuredMissing.reasons, ['WINDOWS_PDF_TRANSPORT_NOT_DISCOVERED'])

const adobeOnly = createInspectWindowsPdfTransportReadinessService({
  env,
  platform: 'win32',
  existsSync: (candidate) => candidate === adobePath,
}).execute()

assert.strictEqual(adobeOnly.ready, false)
assert.strictEqual(adobeOnly.selectedTransport.code, 'ADOBE_READER')
assert.deepStrictEqual(adobeOnly.reasons, ['EXPLICIT_PRINTER_PDF_TRANSPORT_REQUIRED'])

const absent = createInspectWindowsPdfTransportReadinessService({
  env,
  platform: 'win32',
  existsSync: () => false,
}).execute()

assert.strictEqual(absent.ready, false)
assert.strictEqual(absent.selectedTransport, null)
assert.deepStrictEqual(absent.reasons, ['WINDOWS_PDF_TRANSPORT_NOT_DISCOVERED'])

const nonWindows = createInspectWindowsPdfTransportReadinessService({
  env,
  platform: 'linux',
  existsSync: (candidate) => candidate === sumatraPath,
}).execute()

assert.strictEqual(nonWindows.ready, false)
assert.ok(nonWindows.reasons.includes('WINDOWS_PLATFORM_REQUIRED'))

console.log('store-device-windows-pdf-transport-readiness.contract.test.js: PASS')
