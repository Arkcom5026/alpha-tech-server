'use strict'

const assert = require('assert')
const {
  PRINT_EXECUTION_STATUSES,
  assertExecutionEnvelope,
  assertPrintExecutionAdapter,
  createPrintExecutionResult,
} = require('../src/modules/storeDevice/print/printExecutionAdapterContract')

const envelope = Object.freeze({
  schemaVersion: 1,
  job: Object.freeze({ jobId: 'sdj_test', jobType: 'PRINT_DOCUMENT' }),
  lease: Object.freeze({ leaseId: 'sdl_test', attemptNumber: 1 }),
  documentPurpose: Object.freeze({ code: 'SALE_RECEIPT', displayName: 'ใบเสร็จรับเงิน' }),
  source: Object.freeze({ type: 'PAYMENT', id: 638 }),
  print: Object.freeze({ copies: 1 }),
  projection: Object.freeze({ document: Object.freeze({ type: 'SALE_RECEIPT' }) }),
})

assert.strictEqual(assertExecutionEnvelope(envelope), envelope)
assert.deepStrictEqual(PRINT_EXECUTION_STATUSES, [
  'SUCCEEDED',
  'FAILED',
  'TIMEOUT',
  'OFFLINE',
  'PAPER_OUT',
  'UNSUPPORTED',
])

const adapter = {
  name: 'TEST',
  supports() { return true },
  async execute() {},
  async cancel() {},
  capabilities() { return {} },
}
assert.strictEqual(assertPrintExecutionAdapter(adapter), adapter)

const result = createPrintExecutionResult({
  adapter: 'TEST',
  status: 'SUCCEEDED',
  durationMs: 12,
  evidence: { transport: 'none' },
})
assert.strictEqual(result.schemaVersion, 1)
assert.strictEqual(result.adapter, 'TEST')
assert.strictEqual(result.status, 'SUCCEEDED')
assert.strictEqual(result.durationMs, 12)
assert.strictEqual(Object.isFrozen(result), true)

assert.throws(
  () => assertExecutionEnvelope({ schemaVersion: 1 }),
  (error) => error.code === 'STORE_DEVICE_PRINT_EXECUTION_ENVELOPE_INVALID',
)
assert.throws(
  () => assertPrintExecutionAdapter({ name: 'BROKEN' }),
  (error) => error.code === 'STORE_DEVICE_PRINT_ADAPTER_INVALID',
)
assert.throws(
  () => createPrintExecutionResult({ adapter: 'TEST', status: 'UNKNOWN' }),
  (error) => error.code === 'STORE_DEVICE_PRINT_EXECUTION_STATUS_INVALID',
)
assert.throws(
  () => createPrintExecutionResult({ adapter: 'TEST', status: 'SUCCEEDED', durationMs: -1 }),
  (error) => error.code === 'STORE_DEVICE_PRINT_EXECUTION_DURATION_INVALID',
)

console.log('store-device-print-execution-adapter.contract.test.js: PASS')
