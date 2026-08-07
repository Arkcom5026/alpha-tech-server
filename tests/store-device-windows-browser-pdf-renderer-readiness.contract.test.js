'use strict'

const assert = require('assert')
const {
  createInspectWindowsBrowserPdfRendererReadinessService,
} = require('../src/modules/storeDevice/print/render/inspectWindowsBrowserPdfRendererReadinessService')

const env = {
  PROGRAMFILES: 'C:\\Program Files',
  'PROGRAMFILES(X86)': 'C:\\Program Files (x86)',
  LOCALAPPDATA: 'C:\\Users\\operator\\AppData\\Local',
}

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const ready = createInspectWindowsBrowserPdfRendererReadinessService({
  platform: 'win32',
  env,
  existsSync: (candidate) => candidate === edgePath,
}).execute()

assert.strictEqual(ready.strategy, 'LOCAL_GATEWAY_BROWSER_PDF')
assert.strictEqual(ready.mode, 'DISCOVERY_ONLY')
assert.strictEqual(ready.physicalSideEffects, false)
assert.strictEqual(ready.ready, true)
assert.deepStrictEqual(ready.reasons, [])
assert.strictEqual(ready.selectedRenderer.browser, 'EDGE')
assert.strictEqual(ready.selectedRenderer.executablePath, edgePath)

const missing = createInspectWindowsBrowserPdfRendererReadinessService({
  platform: 'win32',
  env,
  existsSync: () => false,
}).execute()

assert.strictEqual(missing.ready, false)
assert.deepStrictEqual(missing.reasons, ['WINDOWS_BROWSER_PDF_RENDERER_NOT_DISCOVERED'])
assert.strictEqual(missing.selectedRenderer, null)

const wrongPlatform = createInspectWindowsBrowserPdfRendererReadinessService({
  platform: 'linux',
  env,
  existsSync: (candidate) => candidate === edgePath,
}).execute()

assert.strictEqual(wrongPlatform.ready, false)
assert.deepStrictEqual(wrongPlatform.reasons, ['WINDOWS_PLATFORM_REQUIRED'])

console.log('store-device-windows-browser-pdf-renderer-readiness.contract.test.js: PASS')
