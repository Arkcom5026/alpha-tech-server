'use strict'

const assert = require('assert')
const {
  renderSaleReceipt80mmHtml,
} = require('../src/modules/storeDevice/print/render/saleReceipt80mmHtmlRenderer')

const projection = {
  document: {
    id: 638,
    type: 'SALE_RECEIPT',
    title: 'ใบเสร็จรับเงิน',
    number: 'PAY-638',
    issuedAt: '2026-08-08T03:00:00.000Z',
    amount: 1234.56,
  },
  issuer: {
    branchId: 2,
    name: 'บริษัท แอดวานซ์ เทค บรรพต จำกัด',
  },
  recipient: {
    id: 9,
    name: 'ลูกค้าทดสอบ <script>',
    phone: '0812345678',
    taxId: null,
  },
  sale: {
    id: 77,
    code: 'SALE-77',
    soldAt: '2026-08-08T02:58:00.000Z',
    status: 'COMPLETED',
    totalBeforeDiscount: 1300,
    totalDiscount: 65.44,
    vatAmount: 80.76,
    totalAmount: 1234.56,
    paidAmount: 1234.56,
    statusPayment: 'PAID',
  },
  payment: {
    id: 638,
    code: 'PAY-638',
    receivedAt: '2026-08-08T03:00:00.000Z',
    amount: 1234.56,
    items: [
      { id: 1, paymentMethod: 'CASH', amount: 1234.56 },
    ],
  },
  lines: [
    {
      id: 1,
      lineType: 'STOCK_ITEM',
      description: 'สินค้าไทย & อุปกรณ์',
      barcode: '885000000001',
      quantity: 1,
      unitAmount: 1300,
      discountAmount: 65.44,
      lineAmount: 1234.56,
      vatAmount: 80.76,
    },
  ],
}

const html = renderSaleReceipt80mmHtml({ projection })

assert.match(html, /<!doctype html>/)
assert.match(html, /@page \{ size: 80mm auto;/)
assert.match(html, /ใบเสร็จรับเงิน/)
assert.match(html, /บริษัท แอดวานซ์ เทค บรรพต จำกัด/)
assert.match(html, /สินค้าไทย &amp; อุปกรณ์/)
assert.match(html, /ลูกค้าทดสอบ &lt;script&gt;/)
assert.match(html, /PAY-638/)
assert.match(html, /SALE-77/)
assert.match(html, /CASH/)
assert.match(html, /1,234\.56/)
assert.doesNotMatch(html, /ลูกค้าทดสอบ <script>/)

assert.throws(
  () => renderSaleReceipt80mmHtml({ projection: { document: { type: 'SALE_RECEIPT' } } }),
  (error) => error?.code === 'STORE_DEVICE_SALE_RECEIPT_80MM_PROJECTION_INVALID',
)

console.log('store-device-sale-receipt-80mm-html-renderer.contract.test.js: PASS')
