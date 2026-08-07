'use strict'

const assert = require('assert')
const {
  createSaleReceipt80mmPdfRenderService,
} = require('../src/modules/storeDevice/print/render/createSaleReceipt80mmPdfRenderService')

const executionEnvelope = Object.freeze({
  schemaVersion: 1,
  job: Object.freeze({ jobId: 'sdj_sale_receipt_pdf_101', jobType: 'PRINT_DOCUMENT' }),
  lease: Object.freeze({ leaseId: 'sdl_sale_receipt_pdf_202' }),
  documentPurpose: Object.freeze({ code: 'SALE_RECEIPT', displayName: 'ใบเสร็จรับเงิน' }),
  source: Object.freeze({ type: 'PAYMENT', id: 638 }),
  print: Object.freeze({ copies: 1 }),
  projection: Object.freeze({
    document: Object.freeze({
      id: 638,
      type: 'SALE_RECEIPT',
      title: 'ใบเสร็จรับเงิน',
      number: 'RC-000638',
      issuedAt: '2026-08-08T03:30:00.000Z',
    }),
    issuer: Object.freeze({ branchId: 2, name: 'บริษัท แอดวานซ์ เทค บรรพต จำกัด' }),
    recipient: Object.freeze({ name: 'ลูกค้าทดสอบ', phone: '0812345678' }),
    sale: Object.freeze({
      id: 303,
      code: 'SALE-000303',
      soldAt: '2026-08-08T03:29:00.000Z',
      totalBeforeDiscount: 1200,
      totalDiscount: 100,
      vatAmount: 71.96,
      totalAmount: 1100,
    }),
    payment: Object.freeze({
      id: 638,
      code: 'RC-000638',
      receivedAt: '2026-08-08T03:30:00.000Z',
      amount: 1100,
      items: Object.freeze([
        Object.freeze({ paymentMethod: 'CASH', amount: 1100 }),
      ]),
    }),
    lines: Object.freeze([
      Object.freeze({
        id: 1,
        lineType: 'STOCK_ITEM',
        description: 'สินค้า ภาษาไทย',
        barcode: '885000000001',
        quantity: 1,
        unitAmount: 1200,
        discountAmount: 100,
        lineAmount: 1100,
        vatAmount: 71.96,
      }),
    ]),
  }),
})

const readinessService = Object.freeze({
  execute() {
    return Object.freeze({
      ready: true,
      reasons: Object.freeze([]),
      selectedRenderer: Object.freeze({
        browser: 'EDGE',
        executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      }),
    })
  },
})

const transportCalls = []
const transport = Object.freeze({
  async execute(input) {
    transportCalls.push(input)
    return Object.freeze({
      pdfBytes: Buffer.from('%PDF-1.7\nsale-receipt-80mm\n'),
      pageCount: 1,
    })
  },
})

async function main() {
  const service = createSaleReceipt80mmPdfRenderService({ readinessService, transport })
  const artifact = await service.execute({ executionEnvelope })

  assert.strictEqual(artifact.format, 'PDF')
  assert.strictEqual(artifact.mediaType, 'application/pdf')
  assert.strictEqual(artifact.renderer, 'WINDOWS_BROWSER_PDF')
  assert.strictEqual(artifact.documentPurpose.code, 'SALE_RECEIPT')
  assert.strictEqual(artifact.source.type, 'PAYMENT')
  assert.strictEqual(artifact.source.id, 638)
  assert.strictEqual(artifact.pageCount, 1)
  assert.strictEqual(artifact.physicalSideEffects, false)
  assert.ok(artifact.byteLength > 5)
  assert.match(artifact.checksum, /^[a-f0-9]{64}$/)
  assert.strictEqual(transportCalls.length, 1)
  assert.match(transportCalls[0].html, /ใบเสร็จรับเงิน/)
  assert.match(transportCalls[0].html, /สินค้า ภาษาไทย/)
  assert.match(transportCalls[0].html, /@page \{ size: 80mm auto;/)

  const wrongPurpose = Object.freeze({
    ...executionEnvelope,
    documentPurpose: Object.freeze({ code: 'DELIVERY_NOTE', displayName: 'ใบส่งสินค้า' }),
  })

  await assert.rejects(
    () => service.execute({ executionEnvelope: wrongPurpose }),
    (error) => error.code === 'STORE_DEVICE_SALE_RECEIPT_80MM_PURPOSE_INVALID',
  )

  console.log('store-device-sale-receipt-80mm-pdf-render.contract.test.js: PASS')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
