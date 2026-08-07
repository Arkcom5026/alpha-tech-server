'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  createDeliveryNotePrintJobService,
} = require('../src/modules/storeDevice/print/createDeliveryNotePrintJobService')

const calls = []
const projector = async ({ branchId, saleId }) => {
  calls.push({ type: 'project', branchId, saleId })
  return {
    document: {
      type: 'DELIVERY_NOTE',
      title: 'ใบส่งสินค้า',
      saleId,
      saleCode: 'S-100',
    },
    issuer: { id: branchId },
    recipient: { name: 'Customer' },
    lines: [{ id: 1, lineAmount: 100 }],
  }
}

const jobService = {
  async createJob(input) {
    calls.push({ type: 'job', input })
    return {
      jobId: 'sdj_test',
      status: 'PENDING',
      requestSnapshot: input.payload.requestSnapshot,
    }
  },
}

const service = createDeliveryNotePrintJobService({ projector, jobService })

;(async () => {
  const result = await service.execute({
    user: { branchId: 2 },
    saleId: '55',
    payload: {
      idempotencyKey: 'print:delivery-note:55:request-1',
      copies: 2,
      targetDeviceId: 'printer-front-counter',
      correlationId: 'sale-55',
    },
  })

  assert.deepStrictEqual(calls[0], { type: 'project', branchId: 2, saleId: 55 })

  const createInput = calls[1].input
  assert.strictEqual(createInput.user.branchId, 2)
  assert.strictEqual(createInput.payload.jobType, 'PRINT_DOCUMENT')
  assert.strictEqual(createInput.payload.source, 'SALE_DELIVERY_NOTE')
  assert.strictEqual(createInput.payload.idempotencyKey, 'print:delivery-note:55:request-1')
  assert.strictEqual(createInput.payload.targetDeviceId, 'printer-front-counter')
  assert.strictEqual(createInput.payload.requestSnapshot.schemaVersion, 1)
  assert.deepStrictEqual(createInput.payload.requestSnapshot.documentPurpose, {
    code: 'DELIVERY_NOTE',
    displayName: 'ใบส่งสินค้า',
  })
  assert.deepStrictEqual(createInput.payload.requestSnapshot.source, {
    type: 'SALE',
    id: 55,
  })
  assert.strictEqual(createInput.payload.requestSnapshot.print.copies, 2)
  assert.strictEqual(createInput.payload.requestSnapshot.projection.document.type, 'DELIVERY_NOTE')
  assert.strictEqual(result.job.jobId, 'sdj_test')
  assert.strictEqual(result.copies, 2)

  await assert.rejects(
    () => service.execute({ user: { branchId: 2 }, saleId: 55, payload: {} }),
    (error) => error.code === 'STORE_DEVICE_PRINT_IDEMPOTENCY_REQUIRED',
  )

  await assert.rejects(
    () => service.execute({
      user: { branchId: 2 },
      saleId: 55,
      payload: { idempotencyKey: 'x', copies: 0 },
    }),
    (error) => error.code === 'STORE_DEVICE_PRINT_COPIES_INVALID',
  )

  const invalidProjectionService = createDeliveryNotePrintJobService({
    projector: async () => ({ document: { type: 'SALE_RECEIPT', title: 'Wrong', saleId: 55 } }),
    jobService,
  })

  await assert.rejects(
    () => invalidProjectionService.execute({
      user: { branchId: 2 },
      saleId: 55,
      payload: { idempotencyKey: 'x' },
    }),
    (error) => error.code === 'STORE_DEVICE_PRINT_PROJECTION_INVALID',
  )

  const routeSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'modules', 'storeDevice', 'routes', 'storeDeviceRoutes.js'),
    'utf8',
  )
  assert.match(routeSource, /router\.post\('\/print\/delivery-notes\/:saleId\/jobs', createDeliveryNotePrintJob\)/)

  console.log('store-device-delivery-note-print-job.contract.test.js: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
