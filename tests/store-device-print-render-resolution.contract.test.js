'use strict'

const assert = require('assert')

const {
  createResolvePrintRenderService,
} = require('../src/modules/storeDevice/print/render/resolvePrintRenderService')

const service = createResolvePrintRenderService()

assert.deepStrictEqual(service.supportedFormats(), ['DRY_RUN_MANIFEST'])

const renderer = service.resolve({ format: 'dry_run_manifest' })
assert.strictEqual(typeof renderer.execute, 'function')

assert.throws(
  () => service.resolve({ format: 'PDF' }),
  (error) => error?.code === 'STORE_DEVICE_PRINT_RENDERER_UNAVAILABLE'
    && error?.statusCode === 409,
)

const customRenderer = Object.freeze({ execute() {} })
const extended = createResolvePrintRenderService({
  renderers: { PDF: customRenderer },
})
assert.strictEqual(extended.resolve({ format: 'PDF' }), customRenderer)
assert.deepStrictEqual(extended.supportedFormats(), ['DRY_RUN_MANIFEST', 'PDF'])

console.log('store-device-print-render-resolution.contract.test.js: PASS')
