'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  createOutputTaxInvoicePrintJobService,
} = require('../src/modules/storeDevice/print/createOutputTaxInvoicePrintJobService')

const buildProjection = ({ taxDocumentId, kind = 'FULL' }) => ({
  document: {
    id: taxDocumentId,
    type: kind === 'FULL' ? 'FULL_TAX_INVOICE' : 'SHORT_TAX_INVOICE',
    title: kind === 'FULL' ? 'ใบกำกับภาษีเต็มรูป' : 'ใบกำกับภาษีอย่างย่อ',
    number: kind === 'FULL' ? 'INV-F-100' : 'INV-S-100',
  },
  issuer: { name: 'Issuer' },
  recipient: kind === 'FULL' ? { name: 'Customer' } : null,
  sale: { id: 55, branchId: 2 },
  lines: [{ id: 1, lineAmount: 100 }],
})

const calls = []
const projector = async ({ branchId, taxDocumentId }) => {
  calls.push({ type: 'project', branchId, taxDocumentId })
  return buildProjection({ taxDocumentId, kind: 'FULL' })
}

const jobService = {
  async createJob(input) {
    calls.push({ type: 'job', input })
    return {
      jobId: 'sdj_tax_test',
      status: 'PENDING',
      requestSnapshot: input.payload.requestSnapshot,
    }
  },
}

const service = createOutputTaxInvoicePrintJobService({ projector, jobService })

;(async () => {
  const result = await service.execute({
    user: { branchId: 2 },
    taxDocumentId: '77',
    payload: {
      idempotencyKey: 'print:output-tax:77:request-1',
      copies: 2,
      targetDeviceId: 'printer-front-counter',
      correlationId: 'tax-77',
    },
  })

  assert.deepStrictEqual(calls[0], { type: 'project', branchId: 2, taxDocumentId: 77 })

  const createInput = calls[1].input
  assert.strictEqual(createInput.user.branchId, 2)
  assert.strictEqual(createInput.payload.jobType, 'PRINT_DOCUMENT')
  assert.strictEqual(createInput.payload.source, 'OUTPUT_TAX_INVOICE')
  assert.strictEqual(createInput.payload.idempotencyKey, 'print:output-tax:77:request-1')
  assert.strictEqual(createInput.payload.targetDeviceId, 'printer-front-counter')
  assert.strictEqual(createInput.payload.requestSnapshot.schemaVersion, 1)
  assert.deepStrictEqual(createInput.payload.requestSnapshot.documentPurpose, {
    code: 'FULL_TAX_INVOICE',
    displayName: 'ใบกำกับภาษีเต็มรูป',
  })
  assert.deepStrictEqual(createInput.payload.requestSnapshot.source, {
    type: 'TAX_DOCUMENT',
    id: 77,
  })
  assert.strictEqual(createInput.payload.requestSnapshot.print.copies, 2)
  assert.strictEqual(
    createInput.payload.requestSnapshot.projection.document.type,
    'FULL_TAX_INVOICE',
  )
  assert.strictEqual(result.job.jobId, 'sdj_tax_test')
  assert.strictEqual(result.copies, 2)

  const shortService = createOutputTaxInvoicePrintJobService({
    projector: async ({ taxDocumentId }) => buildProjection({ taxDocumentId, kind: 'SHORT' }),
    jobService: {
      async createJob(input) {
        return {
          jobId: 'sdj_tax_short',
          status: 'PENDING',
          requestSnapshot: input.payload.requestSnapshot,
        }
      },
    },
  })

  const shortResult = await shortService.execute({
    user: { branchId: 2 },
    taxDocumentId: 78,
    payload: { idempotencyKey: 'print:output-tax:78:request-1' },
  })
  assert.strictEqual(shortResult.documentPurpose.code, 'SHORT_TAX_INVOICE')

  await assert.rejects(
    () => service.execute({ user: { branchId: 2 }, taxDocumentId: 77, payload: {} }),
    (error) => error.code === 'STORE_DEVICE_PRINT_IDEMPOTENCY_REQUIRED',
  )

  await assert.rejects(
    () => service.execute({
      user: { branchId: 2 },
      taxDocumentId: 77,
      payload: { idempotencyKey: 'x', copies: 21 },
    }),
    (error) => error.code === 'STORE_DEVICE_PRINT_COPIES_INVALID',
  )

  const invalidProjectionService = createOutputTaxInvoicePrintJobService({
    projector: async () => ({
      document: { id: 77, type: 'DELIVERY_NOTE', title: 'Wrong' },
    }),
    jobService,
  })

  await assert.rejects(
    () => invalidProjectionService.execute({
      user: { branchId: 2 },
      taxDocumentId: 77,
      payload: { idempotencyKey: 'x' },
    }),
    (error) => error.code === 'STORE_DEVICE_PRINT_PROJECTION_INVALID',
  )

  const conflictService = createOutputTaxInvoicePrintJobService({
    projector: async ({ taxDocumentId }) => buildProjection({ taxDocumentId, kind: 'FULL' }),
    jobService: {
      async createJob() {
        return {
          jobId: 'sdj_existing',
          requestSnapshot: {
            schemaVersion: 1,
            documentPurpose: {
              code: 'FULL_TAX_INVOICE',
              displayName: 'ใบกำกับภาษีเต็มรูป',
            },
            source: { type: 'TAX_DOCUMENT', id: 999 },
            print: { copies: 1 },
          },
        }
      },
    },
  })

  await assert.rejects(
    () => conflictService.execute({
      user: { branchId: 2 },
      taxDocumentId: 77,
      payload: { idempotencyKey: 'reused-key' },
    }),
    (error) =>
      error.code === 'STORE_DEVICE_PRINT_IDEMPOTENCY_CONFLICT'
      && error.statusCode === 409,
  )

  const routeSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'modules', 'storeDevice', 'routes', 'storeDeviceRoutes.js'),
    'utf8',
  )
  assert.match(
    routeSource,
    /router\.post\('\/print\/output-tax-invoices\/:taxDocumentId\/jobs', createOutputTaxInvoicePrintJob\)/,
  )
  assert.ok(
    routeSource.indexOf('router.use(verifyToken)')
      < routeSource.indexOf("router.post('/print/output-tax-invoices/:taxDocumentId/jobs'"),
    'output tax print job route must remain behind verifyToken',
  )

  console.log('store-device-output-tax-invoice-print-job.contract.test.js: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
