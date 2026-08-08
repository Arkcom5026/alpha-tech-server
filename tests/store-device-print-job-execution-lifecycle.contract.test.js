'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const repository = require('../src/modules/storeDevice/repositories/storeDeviceRepository')
const {
  createPrintDocumentExecutionService,
} = require('../src/modules/storeDevice/print/completePrintDocumentJobService')

const originalFindLease = repository.findLease

const snapshot = {
  schemaVersion: 1,
  documentPurpose: { code: 'DELIVERY_NOTE', displayName: 'ใบส่งสินค้า' },
  source: { type: 'SALE', id: 55 },
  print: { copies: 2 },
  projection: { document: { type: 'DELIVERY_NOTE', saleId: 55 } },
}

repository.findLease = async (branchId, leaseId) => ({
  id: 7,
  leaseId,
  branchId,
  expiresAt: new Date(Date.now() + 60_000),
  job: {
    jobId: 'sdj_print_1',
    jobType: 'PRINT_DOCUMENT',
    requestSnapshot: snapshot,
  },
})

const calls = []
const jobService = {
  async acknowledgeOrProgress(input) {
    calls.push({ type: 'ack', input })
    return {
      leaseId: input.leaseId,
      gatewayId: input.payload.gatewayId,
      sessionId: input.payload.sessionId,
      acknowledged: true,
    }
  },
  async complete(input) {
    calls.push({ type: 'complete', input })
    return {
      resultId: input.payload.resultId,
      status: input.status,
      resultSnapshot: input.payload.resultSnapshot,
    }
  },
}

const service = createPrintDocumentExecutionService({ jobService })

;(async () => {
  const ack = await service.acknowledge({
    user: { branchId: 2 },
    leaseId: 'sdl_1',
    payload: { gatewayId: 'gw-1', sessionId: 'session-1' },
  })

  assert.strictEqual(calls[0].type, 'ack')
  assert.strictEqual(calls[0].input.acknowledge, true)
  assert.deepStrictEqual(ack.documentPurpose, snapshot.documentPurpose)
  assert.deepStrictEqual(ack.source, snapshot.source)

  const completed = await service.complete({
    user: { branchId: 2 },
    leaseId: 'sdl_1',
    status: 'SUCCEEDED',
    payload: {
      gatewayId: 'gw-1',
      sessionId: 'session-1',
      resultId: 'print-result-1',
      adapterEvidence: { adapter: 'WINDOWS_PRINT' },
      transportEvidence: { channel: 'LOCAL_GATEWAY' },
      executionSnapshot: { printerName: 'Front Counter' },
    },
  })

  const completeInput = calls[1].input
  assert.strictEqual(completeInput.status, 'SUCCEEDED')
  assert.strictEqual(completeInput.payload.resultId, 'print-result-1')
  assert.deepStrictEqual(completeInput.payload.resultSnapshot.execution, {
    kind: 'PRINT_DOCUMENT',
    status: 'SUCCEEDED',
    documentPurpose: snapshot.documentPurpose,
    source: snapshot.source,
    copies: 2,
  })
  assert.deepStrictEqual(completeInput.payload.resultSnapshot.gateway, {
    printerName: 'Front Counter',
  })
  assert.strictEqual(completeInput.payload.errorMetadata, null)
  assert.strictEqual(completed.status, 'SUCCEEDED')

  await service.complete({
    user: { branchId: 2 },
    leaseId: 'sdl_1',
    status: 'FAILED',
    payload: {
      gatewayId: 'gw-1',
      sessionId: 'session-1',
      resultId: 'print-result-2',
      errorMetadata: { code: 'PRINTER_OFFLINE' },
    },
  })
  assert.deepStrictEqual(calls[2].input.payload.errorMetadata, { code: 'PRINTER_OFFLINE' })

  await assert.rejects(
    () => service.complete({
      user: { branchId: 2 },
      leaseId: 'sdl_1',
      status: 'SUCCEEDED',
      payload: { gatewayId: 'gw-1', sessionId: 'session-1' },
    }),
    (error) => error.code === 'STORE_DEVICE_PRINT_RESULT_ID_REQUIRED',
  )

  repository.findLease = async () => ({
    expiresAt: new Date(Date.now() + 60_000),
    job: { jobType: 'DEVICE_DIAGNOSTIC', requestSnapshot: snapshot },
  })
  await assert.rejects(
    () => service.acknowledge({
      user: { branchId: 2 },
      leaseId: 'sdl_wrong',
      payload: { gatewayId: 'gw-1', sessionId: 'session-1' },
    }),
    (error) => error.code === 'STORE_DEVICE_PRINT_EXECUTION_CONTRACT_INVALID',
  )

  repository.findLease = async () => ({
    expiresAt: new Date(Date.now() - 1_000),
    job: {
      jobId: 'sdj_expired',
      jobType: 'PRINT_DOCUMENT',
      requestSnapshot: snapshot,
    },
  })
  await assert.rejects(
    () => service.acknowledge({
      user: { branchId: 2 },
      leaseId: 'sdl_expired',
      payload: { gatewayId: 'gw-1', sessionId: 'session-1' },
    }),
    (error) => error.code === 'STORE_DEVICE_LEASE_EXPIRED' && error.statusCode === 409,
  )
  await assert.rejects(
    () => service.complete({
      user: { branchId: 2 },
      leaseId: 'sdl_expired',
      status: 'SUCCEEDED',
      payload: {
        gatewayId: 'gw-1',
        sessionId: 'session-1',
        resultId: 'print-result-expired',
      },
    }),
    (error) => error.code === 'STORE_DEVICE_LEASE_EXPIRED' && error.statusCode === 409,
  )

  const routeSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'modules', 'storeDevice', 'routes', 'storeDeviceRoutes.js'),
    'utf8',
  )
  assert.match(routeSource, /router\.use\(verifyToken\)/)
  assert.match(routeSource, /router\.post\('\/print\/leases\/:leaseId\/acknowledge', acknowledgePrintDocumentJob\)/)
  assert.match(routeSource, /router\.post\('\/print\/leases\/:leaseId\/complete', completePrintDocumentJob\)/)
  assert.match(routeSource, /router\.post\('\/print\/leases\/:leaseId\/fail', failPrintDocumentJob\)/)

  const repositorySource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'modules', 'storeDevice', 'repositories', 'storeDeviceRepository.js'),
    'utf8',
  )
  assert.match(repositorySource, /expiresAt:\s*\{\s*gt:\s*now\s*\}/)
  assert.match(repositorySource, /expiresAt:\s*\{\s*gt:\s*new Date\(\)\s*\}/)

  console.log('store-device-print-job-execution-lifecycle.contract.test.js: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(() => {
  repository.findLease = originalFindLease
})
