'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  dryRunPrintExecutionAdapter,
} = require('../src/modules/storeDevice/print/adapters/dryRunPrintExecutionAdapter')

const envelope = Object.freeze({
  schemaVersion: 1,
  job: Object.freeze({ jobId: 'sdj_dry_run', jobType: 'PRINT_DOCUMENT' }),
  lease: Object.freeze({ leaseId: 'sdl_dry_run', attemptNumber: 1 }),
  documentPurpose: Object.freeze({ code: 'FULL_TAX_INVOICE', displayName: 'ใบกำกับภาษีเต็มรูป' }),
  source: Object.freeze({ type: 'TAX_DOCUMENT', id: 77 }),
  print: Object.freeze({ copies: 2 }),
  projection: Object.freeze({ document: Object.freeze({ type: 'FULL_TAX_INVOICE', id: 77 }) }),
})

;(async () => {
  assert.strictEqual(dryRunPrintExecutionAdapter.supports(envelope), true)

  const capabilities = dryRunPrintExecutionAdapter.capabilities()
  assert.strictEqual(capabilities.dryRun, true)
  assert.strictEqual(capabilities.physicalSideEffects, false)

  const success = await dryRunPrintExecutionAdapter.execute(envelope, {
    scenario: 'SUCCEEDED',
    durationMs: 42,
  })
  assert.strictEqual(success.adapter, 'DRY_RUN')
  assert.strictEqual(success.status, 'SUCCEEDED')
  assert.strictEqual(success.durationMs, 42)
  assert.strictEqual(success.evidence.jobId, 'sdj_dry_run')
  assert.strictEqual(success.evidence.leaseId, 'sdl_dry_run')
  assert.strictEqual(success.evidence.documentPurposeCode, 'FULL_TAX_INVOICE')
  assert.strictEqual(success.evidence.copies, 2)
  assert.strictEqual(success.evidence.physicalSideEffects, false)
  assert.strictEqual(success.error, null)

  for (const status of ['FAILED', 'TIMEOUT', 'OFFLINE', 'PAPER_OUT', 'UNSUPPORTED']) {
    const result = await dryRunPrintExecutionAdapter.execute(envelope, { scenario: status })
    assert.strictEqual(result.status, status)
    assert.strictEqual(result.error.code, `DRY_RUN_${status}`)
  }

  const cancelled = await dryRunPrintExecutionAdapter.cancel(envelope)
  assert.strictEqual(cancelled.cancelled, true)
  assert.strictEqual(cancelled.physicalSideEffects, false)

  const source = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'src',
      'modules',
      'storeDevice',
      'print',
      'adapters',
      'dryRunPrintExecutionAdapter.js',
    ),
    'utf8',
  )

  for (const forbidden of [
    'child_process',
    'exec(',
    'execFile(',
    'spawn(',
    'powershell',
    'winspool',
    'printer',
    'usb',
    'net.connect',
    'prisma',
  ]) {
    assert.strictEqual(
      source.toLowerCase().includes(forbidden.toLowerCase()),
      false,
      `Dry-run adapter must not contain physical/DB side effect primitive: ${forbidden}`,
    )
  }

  console.log('store-device-print-dry-run.contract.test.js: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
