'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const {
  createExecutePrintDocumentLeaseService,
} = require('../src/modules/storeDevice/print/executePrintDocumentLeaseService')

const envelope = Object.freeze({
  schemaVersion: 1,
  job: Object.freeze({
    jobId: 'sdj_test',
    jobType: 'PRINT_DOCUMENT',
    source: 'SALE_RECEIPT',
    correlationId: null,
    causationId: null,
  }),
  lease: Object.freeze({
    leaseId: 'sdl_test',
    attemptNumber: 1,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  }),
  documentPurpose: Object.freeze({
    code: 'SALE_RECEIPT',
    displayName: 'ใบเสร็จรับเงิน',
  }),
  source: Object.freeze({ type: 'PAYMENT', id: 638 }),
  print: Object.freeze({ copies: 1 }),
  projection: Object.freeze({ document: { type: 'SALE_RECEIPT' } }),
})

const user = { branchId: 2 }

const successOrder = []
const successExecution = {
  async acknowledge(args) {
    successOrder.push('ACKNOWLEDGE')
    assert.equal(args.leaseId, 'sdl_test')
    assert.equal(args.payload.gatewayId, 'gw-1')
    assert.equal(args.payload.sessionId, 'sess-1')
    return { acknowledged: true }
  },
  async complete(args) {
    successOrder.push(`COMPLETE:${args.status}`)
    assert.equal(args.status, 'SUCCEEDED')
    assert.equal(args.payload.resultId, 'result-1')
    assert.equal(args.payload.executionSnapshot.status, 'SUCCEEDED')
    assert.equal(args.payload.adapterEvidence.adapter, 'DRY_RUN')
    assert.equal(args.payload.errorMetadata, null)
    return { result: { status: 'SUCCEEDED' } }
  },
}

const successResolver = {
  execute({ executionEnvelope, adapterCode }) {
    successOrder.push('RESOLVE')
    assert.equal(executionEnvelope, envelope)
    assert.equal(adapterCode, 'DRY_RUN')
    return {
      adapterCode: 'DRY_RUN',
      capabilities: Object.freeze({ dryRun: true, physicalSideEffects: false }),
      adapter: {
        async execute(receivedEnvelope, options) {
          successOrder.push('EXECUTE')
          assert.equal(receivedEnvelope, envelope)
          assert.equal(options.scenario, 'SUCCEEDED')
          return Object.freeze({
            schemaVersion: 1,
            adapter: 'DRY_RUN',
            status: 'SUCCEEDED',
            durationMs: 2,
            evidence: Object.freeze({ dryRun: true }),
            error: null,
          })
        },
      },
    }
  },
}

const successService = createExecutePrintDocumentLeaseService({
  resolverService: successResolver,
  executionService: successExecution,
})

;(async () => {
  const success = await successService.execute({
    user,
    executionEnvelope: envelope,
    gatewayId: 'gw-1',
    sessionId: 'sess-1',
    resultId: 'result-1',
    adapterCode: 'DRY_RUN',
    adapterOptions: { scenario: 'SUCCEEDED' },
  })

  assert.deepEqual(successOrder, [
    'RESOLVE',
    'ACKNOWLEDGE',
    'EXECUTE',
    'COMPLETE:SUCCEEDED',
  ])
  assert.equal(success.lifecycleStatus, 'SUCCEEDED')
  assert.equal(success.adapterResult.status, 'SUCCEEDED')

  const failureCalls = []
  const failureService = createExecutePrintDocumentLeaseService({
    resolverService: {
      execute() {
        return {
          adapterCode: 'DRY_RUN',
          capabilities: { dryRun: true, physicalSideEffects: false },
          adapter: {
            async execute() {
              return {
                schemaVersion: 1,
                adapter: 'DRY_RUN',
                status: 'PAPER_OUT',
                durationMs: 1,
                evidence: { simulated: true },
                error: { code: 'DRY_RUN_PAPER_OUT' },
              }
            },
          },
        }
      },
    },
    executionService: {
      async acknowledge() {
        failureCalls.push('ACKNOWLEDGE')
      },
      async complete(args) {
        failureCalls.push(`COMPLETE:${args.status}`)
        assert.equal(args.status, 'FAILED')
        assert.equal(args.payload.executionSnapshot.status, 'PAPER_OUT')
        assert.equal(args.payload.errorMetadata.code, 'DRY_RUN_PAPER_OUT')
        assert.equal(args.payload.errorMetadata.adapterStatus, 'PAPER_OUT')
        return { result: { status: 'FAILED' } }
      },
    },
  })

  const failure = await failureService.execute({
    user,
    executionEnvelope: envelope,
    gatewayId: 'gw-1',
    sessionId: 'sess-1',
    resultId: 'result-2',
    adapterOptions: { scenario: 'PAPER_OUT' },
  })
  assert.deepEqual(failureCalls, ['ACKNOWLEDGE', 'COMPLETE:FAILED'])
  assert.equal(failure.lifecycleStatus, 'FAILED')
  assert.equal(failure.adapterResult.status, 'PAPER_OUT')

  const thrownCalls = []
  const thrownService = createExecutePrintDocumentLeaseService({
    resolverService: {
      execute() {
        return {
          adapterCode: 'DRY_RUN',
          capabilities: { dryRun: true, physicalSideEffects: false },
          adapter: {
            async execute() {
              throw Object.assign(new Error('simulated adapter throw'), {
                code: 'SIMULATED_THROW',
              })
            },
          },
        }
      },
    },
    executionService: {
      async acknowledge() {
        thrownCalls.push('ACKNOWLEDGE')
      },
      async complete(args) {
        thrownCalls.push(`COMPLETE:${args.status}`)
        assert.equal(args.status, 'FAILED')
        assert.equal(args.payload.executionSnapshot.status, 'FAILED')
        assert.equal(args.payload.errorMetadata.code, 'SIMULATED_THROW')
        return { result: { status: 'FAILED' } }
      },
    },
  })

  const thrown = await thrownService.execute({
    user,
    executionEnvelope: envelope,
    gatewayId: 'gw-1',
    sessionId: 'sess-1',
    resultId: 'result-3',
  })
  assert.deepEqual(thrownCalls, ['ACKNOWLEDGE', 'COMPLETE:FAILED'])
  assert.equal(thrown.lifecycleStatus, 'FAILED')
  assert.equal(thrown.adapterResult.status, 'FAILED')
  assert.equal(thrown.adapterResult.error.code, 'SIMULATED_THROW')

  const source = fs.readFileSync(
    path.join(
      __dirname,
      '../src/modules/storeDevice/print/executePrintDocumentLeaseService.js',
    ),
    'utf8',
  )
  for (const forbidden of [
    'child_process',
    'exec(',
    'spawn(',
    'powershell',
    'winspool',
    'usb',
    '@prisma/client',
    'prisma.',
  ]) {
    assert.equal(
      source.toLowerCase().includes(forbidden.toLowerCase()),
      false,
      `orchestration must not contain physical/DB side effect primitive: ${forbidden}`,
    )
  }

  console.log('store-device-print-adapter-orchestration.contract.test.js: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
