'use strict'

const assert = require('assert')
const {
  createResolvePrintExecutionAdapterService,
} = require('../src/modules/storeDevice/print/resolvePrintExecutionAdapterService')

const envelope = {
  schemaVersion: 1,
  job: { jobId: 'sdj_resolution', jobType: 'PRINT_DOCUMENT' },
  lease: { leaseId: 'sdl_resolution', attemptNumber: 1 },
  documentPurpose: { code: 'DELIVERY_NOTE', displayName: 'ใบส่งสินค้า' },
  source: { type: 'SALE', id: 55 },
  print: { copies: 2 },
  projection: { document: { type: 'DELIVERY_NOTE' } },
}

const service = createResolvePrintExecutionAdapterService()
const resolved = service.execute({ executionEnvelope: envelope })
assert.strictEqual(resolved.adapterCode, 'DRY_RUN')
assert.strictEqual(resolved.adapter.name, 'DRY_RUN')
assert.strictEqual(resolved.capabilities.dryRun, true)
assert.strictEqual(resolved.capabilities.physicalSideEffects, false)
assert.strictEqual(Object.isFrozen(resolved), true)

const unsupportedAdapter = {
  name: 'NO_SUPPORT',
  supports() { return false },
  async execute() {},
  async cancel() {},
  capabilities() { return { dryRun: true } },
}

const custom = createResolvePrintExecutionAdapterService({
  adapters: { NO_SUPPORT: unsupportedAdapter },
})
assert.throws(
  () => custom.execute({ executionEnvelope: envelope, adapterCode: 'NO_SUPPORT' }),
  (error) => error.code === 'STORE_DEVICE_PRINT_ADAPTER_UNSUPPORTED' && error.statusCode === 409,
)

assert.throws(
  () => service.execute({ executionEnvelope: envelope, adapterCode: 'WINDOWS' }),
  (error) => error.code === 'STORE_DEVICE_PRINT_ADAPTER_NOT_FOUND' && error.statusCode === 404,
)

console.log('store-device-print-adapter-resolution.contract.test.js: PASS')
