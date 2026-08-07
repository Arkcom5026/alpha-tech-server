'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  createLeasePrintDocumentJobService,
} = require('../src/modules/storeDevice/print/leasePrintDocumentJobService')

const calls = []
const job = {
  jobId: 'sdj_print_1',
  jobType: 'PRINT_DOCUMENT',
  source: 'SALE_DELIVERY_NOTE',
  correlationId: 'sale-55',
  causationId: null,
  requestSnapshot: {
    schemaVersion: 1,
    documentPurpose: {
      code: 'DELIVERY_NOTE',
      displayName: 'ใบส่งสินค้า',
    },
    source: {
      type: 'SALE',
      id: 55,
    },
    print: {
      copies: 2,
    },
    projection: {
      document: {
        type: 'DELIVERY_NOTE',
        title: 'ใบส่งสินค้า',
        saleId: 55,
      },
      lines: [],
    },
  },
}

const lease = {
  leaseId: 'sdl_print_1',
  attemptNumber: 1,
  expiresAt: new Date('2026-08-08T00:00:00.000Z'),
}

const jobService = {
  async getJob(input) {
    calls.push({ type: 'getJob', input })
    return job
  },
  async leaseJob(input) {
    calls.push({ type: 'leaseJob', input })
    return lease
  },
}

const service = createLeasePrintDocumentJobService({ jobService })

;(async () => {
  const result = await service.execute({
    user: { branchId: 2 },
    jobId: 'sdj_print_1',
    payload: {
      gatewayId: 'gw-branch-2',
      sessionId: 'session-1',
      expiresAt: '2026-08-08T00:00:00.000Z',
    },
  })

  assert.deepStrictEqual(calls[0], {
    type: 'getJob',
    input: { user: { branchId: 2 }, jobId: 'sdj_print_1' },
  })
  assert.strictEqual(calls[1].type, 'leaseJob')
  assert.deepStrictEqual(calls[1].input.payload, {
    gatewayId: 'gw-branch-2',
    sessionId: 'session-1',
    expiresAt: '2026-08-08T00:00:00.000Z',
  })

  assert.strictEqual(result.lease.leaseId, 'sdl_print_1')
  assert.deepStrictEqual(result.executionEnvelope.documentPurpose, {
    code: 'DELIVERY_NOTE',
    displayName: 'ใบส่งสินค้า',
  })
  assert.deepStrictEqual(result.executionEnvelope.source, {
    type: 'SALE',
    id: 55,
  })
  assert.strictEqual(result.executionEnvelope.print.copies, 2)
  assert.strictEqual(result.executionEnvelope.projection, job.requestSnapshot.projection)
  assert.strictEqual(result.executionEnvelope.job.jobId, 'sdj_print_1')
  assert.strictEqual(result.executionEnvelope.lease.leaseId, 'sdl_print_1')

  const invalidJobService = {
    async getJob() {
      return {
        ...job,
        jobType: 'DEVICE_DIAGNOSTIC',
      }
    },
    async leaseJob() {
      throw new Error('lease must not be created')
    },
  }

  await assert.rejects(
    () => createLeasePrintDocumentJobService({ jobService: invalidJobService }).execute({
      user: { branchId: 2 },
      jobId: 'sdj_diag_1',
      payload: {
        gatewayId: 'gw-branch-2',
        sessionId: 'session-1',
        expiresAt: '2026-08-08T00:00:00.000Z',
      },
    }),
    (error) => error.code === 'STORE_DEVICE_PRINT_JOB_SNAPSHOT_INVALID' && error.statusCode === 409,
  )

  const routeSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'modules', 'storeDevice', 'routes', 'storeDeviceRoutes.js'),
    'utf8',
  )
  assert.match(routeSource, /router\.use\(verifyToken\)/)
  assert.match(routeSource, /router\.post\('\/print\/jobs\/:jobId\/leases', leasePrintDocumentJob\)/)

  const serviceSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'modules', 'storeDevice', 'print', 'leasePrintDocumentJobService.js'),
    'utf8',
  )
  assert.doesNotMatch(serviceSource, /rawCommand|printerCommand|child_process|exec\(|spawn\(/i)

  console.log('store-device-print-job-lease-handoff.contract.test.js: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
