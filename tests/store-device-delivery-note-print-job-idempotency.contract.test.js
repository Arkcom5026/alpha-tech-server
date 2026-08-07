'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  createDeliveryNotePrintJobService,
} = require('../src/modules/storeDevice/print/createDeliveryNotePrintJobService')

const projection = {
  document: {
    type: 'DELIVERY_NOTE',
    title: 'ใบส่งสินค้า',
    saleId: 55,
    saleCode: 'S-55',
  },
  issuer: { id: 2 },
  recipient: { name: 'Customer' },
  lines: [{ id: 1, lineAmount: 100 }],
}

const projector = async ({ branchId, saleId }) => ({
  ...projection,
  document: { ...projection.document, saleId },
  issuer: { id: branchId },
})

const compatibleJobService = {
  async createJob(input) {
    return {
      jobId: 'sdj_same',
      status: 'PENDING',
      requestSnapshot: input.payload.requestSnapshot,
    }
  },
}

;(async () => {
  const service = createDeliveryNotePrintJobService({
    projector,
    jobService: compatibleJobService,
  })

  const replay = await service.execute({
    user: { branchId: 2 },
    saleId: 55,
    payload: {
      idempotencyKey: 'print:delivery-note:55:req-1',
      copies: 2,
    },
  })

  assert.strictEqual(replay.job.jobId, 'sdj_same')
  assert.strictEqual(replay.source.id, 55)
  assert.strictEqual(replay.documentPurpose.code, 'DELIVERY_NOTE')
  assert.strictEqual(replay.copies, 2)

  const conflictingJobService = {
    async createJob() {
      return {
        jobId: 'sdj_existing',
        status: 'PENDING',
        requestSnapshot: {
          schemaVersion: 1,
          documentPurpose: {
            code: 'DELIVERY_NOTE',
            displayName: 'ใบส่งสินค้า',
          },
          source: {
            type: 'SALE',
            id: 99,
          },
          print: {
            copies: 1,
          },
          projection: {
            document: {
              type: 'DELIVERY_NOTE',
              title: 'ใบส่งสินค้า',
              saleId: 99,
            },
          },
        },
      }
    },
  }

  const conflictService = createDeliveryNotePrintJobService({
    projector,
    jobService: conflictingJobService,
  })

  await assert.rejects(
    () => conflictService.execute({
      user: { branchId: 2 },
      saleId: 55,
      payload: {
        idempotencyKey: 'reused-key',
        copies: 2,
      },
    }),
    (error) => error.code === 'STORE_DEVICE_PRINT_IDEMPOTENCY_CONFLICT'
      && error.statusCode === 409,
  )

  const controllerSource = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'src',
      'modules',
      'storeDevice',
      'print',
      'createDeliveryNotePrintJobController.js',
    ),
    'utf8',
  )

  assert.match(controllerSource, /res\.status\(error\.statusCode \|\| 500\)/)
  assert.match(controllerSource, /code: error\.code \|\| 'STORE_DEVICE_PRINT_JOB_FAILED'/)

  const routeSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'modules', 'storeDevice', 'routes', 'storeDeviceRoutes.js'),
    'utf8',
  )

  assert.match(routeSource, /router\.use\(verifyToken\)/)
  assert.match(routeSource, /router\.post\('\/print\/delivery-notes\/:saleId\/jobs', createDeliveryNotePrintJob\)/)

  console.log('store-device-delivery-note-print-job-idempotency.contract.test.js: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
