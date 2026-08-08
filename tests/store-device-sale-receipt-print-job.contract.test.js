'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  createSaleReceiptPrintJobService,
} = require('../src/modules/storeDevice/print/createSaleReceiptPrintJobService')

const calls = []
const projector = async ({ branchId, paymentId }) => {
  calls.push({ type: 'project', branchId, paymentId })
  return {
    document: {
      id: paymentId,
      type: 'SALE_RECEIPT',
      title: 'ใบเสร็จรับเงิน',
      number: 'PMT-100',
      amount: 100,
    },
    issuer: { branchId, name: 'Store' },
    recipient: { name: 'Customer' },
    sale: { id: 55, code: 'S-55', totalAmount: 100 },
    payment: { id: paymentId, code: 'PMT-100', amount: 100 },
    lines: [{ id: 1, lineAmount: 100 }],
  }
}

const jobService = {
  async createJob(input) {
    calls.push({ type: 'job', input })
    return {
      jobId: 'sdj_receipt',
      status: 'PENDING',
      requestSnapshot: input.payload.requestSnapshot,
    }
  },
}

const service = createSaleReceiptPrintJobService({ projector, jobService })

;(async () => {
  const result = await service.execute({
    user: { branchId: 2 },
    paymentId: '638',
    payload: {
      idempotencyKey: 'print:sale-receipt:638:request-1',
      copies: 2,
      targetDeviceId: 'printer-front-counter',
    },
  })

  assert.deepStrictEqual(calls[0], {
    type: 'project',
    branchId: 2,
    paymentId: 638,
  })

  const createInput = calls[1].input
  assert.strictEqual(createInput.user.branchId, 2)
  assert.strictEqual(createInput.payload.jobType, 'PRINT_DOCUMENT')
  assert.strictEqual(createInput.payload.source, 'SALE_RECEIPT')
  assert.strictEqual(
    createInput.payload.idempotencyKey,
    'print:sale-receipt:638:request-1',
  )
  assert.strictEqual(createInput.payload.targetDeviceId, 'printer-front-counter')
  assert.strictEqual(createInput.payload.requestSnapshot.schemaVersion, 1)
  assert.deepStrictEqual(createInput.payload.requestSnapshot.documentPurpose, {
    code: 'SALE_RECEIPT',
    displayName: 'ใบเสร็จรับเงิน',
  })
  assert.deepStrictEqual(createInput.payload.requestSnapshot.source, {
    type: 'PAYMENT',
    id: 638,
  })
  assert.strictEqual(createInput.payload.requestSnapshot.print.copies, 2)
  assert.strictEqual(
    createInput.payload.requestSnapshot.projection.document.type,
    'SALE_RECEIPT',
  )
  assert.strictEqual(result.job.jobId, 'sdj_receipt')
  assert.strictEqual(result.copies, 2)

  await assert.rejects(
    () => service.execute({ user: { branchId: 2 }, paymentId: 638, payload: {} }),
    (error) => error.code === 'STORE_DEVICE_PRINT_IDEMPOTENCY_REQUIRED',
  )

  const conflictService = createSaleReceiptPrintJobService({
    projector,
    jobService: {
      async createJob(input) {
        return {
          jobId: 'sdj_existing',
          requestSnapshot: {
            ...input.payload.requestSnapshot,
            source: { type: 'PAYMENT', id: 999 },
          },
        }
      },
    },
  })

  await assert.rejects(
    () => conflictService.execute({
      user: { branchId: 2 },
      paymentId: 638,
      payload: { idempotencyKey: 'reused-key' },
    }),
    (error) =>
      error.code === 'STORE_DEVICE_PRINT_IDEMPOTENCY_CONFLICT'
      && error.statusCode === 409,
  )

  const invalidProjectionService = createSaleReceiptPrintJobService({
    projector: async () => ({
      document: { id: 638, type: 'DELIVERY_NOTE', title: 'Wrong' },
    }),
    jobService,
  })

  await assert.rejects(
    () => invalidProjectionService.execute({
      user: { branchId: 2 },
      paymentId: 638,
      payload: { idempotencyKey: 'x' },
    }),
    (error) => error.code === 'STORE_DEVICE_PRINT_PROJECTION_INVALID',
  )

  const routeSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'modules', 'storeDevice', 'routes', 'storeDeviceRoutes.js'),
    'utf8',
  )
  assert.match(
    routeSource,
    /router\.post\('\/print\/sale-receipts\/:paymentId\/jobs', createSaleReceiptPrintJob\)/,
  )

  const projectorSource = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'src',
      'modules',
      'sales',
      'payment',
      'query',
      'printable',
      'projectSaleReceiptPrintablePaymentService.js',
    ),
    'utf8',
  )
  assert.match(projectorSource, /code: 'SALE_RECEIPT'/)
  assert.match(projectorSource, /branchId: normalizedBranchId/)
  assert.match(projectorSource, /isCancelled: false/)
  assert.match(projectorSource, /simpleItems:/)
  assert.doesNotMatch(projectorSource, /phone:\s*true/)
  assert.doesNotMatch(projectorSource, /payment\.sale\.customer\.phone/)

  const customerSchemaSource = fs.readFileSync(
    path.join(__dirname, '..', 'prisma', 'customer', 'customer.prisma'),
    'utf8',
  )
  const customerProfileBlock = customerSchemaSource.match(
    /model CustomerProfile \{[\s\S]*?\n\}/,
  )?.[0] || ''
  assert.ok(customerProfileBlock)
  assert.doesNotMatch(customerProfileBlock, /^\s*phone\s+/m)

  console.log('store-device-sale-receipt-print-job.contract.test.js: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
