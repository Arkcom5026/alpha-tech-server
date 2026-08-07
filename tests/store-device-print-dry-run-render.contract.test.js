'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  createDryRunPrintRenderService,
} = require('../src/modules/storeDevice/print/render/dryRunPrintRenderService')
const {
  assertPrintRenderArtifact,
} = require('../src/modules/storeDevice/print/render/printRenderArtifactContract')

const executionEnvelope = Object.freeze({
  schemaVersion: 1,
  job: Object.freeze({ jobId: 'job-render-1', jobType: 'PRINT_DOCUMENT' }),
  lease: Object.freeze({ leaseId: 'lease-render-1' }),
  documentPurpose: Object.freeze({
    code: 'FULL_TAX_INVOICE',
    displayName: 'ใบกำกับภาษีเต็มรูป',
  }),
  source: Object.freeze({ type: 'TAX_DOCUMENT', id: 456 }),
  print: Object.freeze({ copies: 2 }),
  projection: Object.freeze({
    document: Object.freeze({ id: 456, number: 'TAX-456' }),
    lines: Object.freeze([]),
  }),
})

const before = JSON.stringify(executionEnvelope)
const artifact = createDryRunPrintRenderService().execute({ executionEnvelope })

assertPrintRenderArtifact(artifact)
assert.strictEqual(artifact.format, 'DRY_RUN_MANIFEST')
assert.strictEqual(artifact.renderer, 'DRY_RUN_RENDERER')
assert.strictEqual(artifact.physicalSideEffects, false)
assert.strictEqual(artifact.documentPurpose.code, 'FULL_TAX_INVOICE')
assert.strictEqual(artifact.source.type, 'TAX_DOCUMENT')
assert.strictEqual(artifact.source.id, 456)
assert.strictEqual(artifact.payload.copies, 2)
assert.ok(/^sha256:[0-9a-f]{64}$/.test(artifact.checksum))
assert.ok(artifact.byteLength > 0)
assert.strictEqual(JSON.stringify(executionEnvelope), before)

const source = fs.readFileSync(
  path.join(__dirname, '../src/modules/storeDevice/print/render/dryRunPrintRenderService.js'),
  'utf8',
)

for (const forbidden of [
  'child_process',
  'powershell',
  'Get-Printer',
  'Start-Process',
  'winspool',
  'usb',
  'prisma',
  '$executeRaw',
]) {
  assert.strictEqual(
    source.toLowerCase().includes(forbidden.toLowerCase()),
    false,
    `dry-run renderer must not contain ${forbidden}`,
  )
}

console.log('store-device-print-dry-run-render.contract.test.js: PASS')
