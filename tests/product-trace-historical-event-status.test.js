const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildProductTraceTimeline,
} = require('../src/modules/product/trace/builders/productTraceTimelineBuilder')

const permissions = {
  canViewFinancials: true,
  canViewSupplier: true,
}

test('historical inventory events retain Thai titles and IN_STOCK after sale', () => {
  const events = buildProductTraceTimeline({
    stockItem: {
      id: 3804,
      status: 'SOLD',
      receivedAt: new Date('2026-07-06T07:53:00.000Z'),
      scannedAt: new Date('2026-07-06T07:53:01.000Z'),
      scannedBy: { id: 35, name: 'Kanjana Admin' },
      locationCode: null,
    },
    procurement: {
      costPrice: 235,
      receipt: null,
      supplier: null,
      purchaseOrder: null,
    },
    sales: null,
    returns: [],
    claims: [],
    repairs: [],
    permissions,
  })

  const received = events.find((event) => event.id === 'received-3804')
  const scanned = events.find((event) => event.id === 'scanned-3804')

  assert.equal(received?.title, 'รับสินค้าเข้าสต็อก')
  assert.equal(received?.status, 'IN_STOCK')
  assert.equal(scanned?.title, 'บันทึกสินค้าเข้าระบบ')
  assert.equal(scanned?.status, 'IN_STOCK')
})

test('return, refund and sale titles remain valid UTF-8', () => {
  const events = buildProductTraceTimeline({
    stockItem: { id: 3804, status: 'SOLD' },
    procurement: null,
    sales: {
      cycles: [{
        sale: {
          id: 50,
          code: 'SL-0050',
          soldAt: '2026-07-23T11:20:00.000Z',
          status: 'COMPLETED',
          statusPayment: 'PAID',
          employee: null,
          customer: null,
        },
        pricing: { netPrice: 260 },
      }],
    },
    returns: [{
      returnItemId: 1,
      reason: 'ทดสอบ',
      refundAmount: 260,
      refundTransactions: [{
        id: 1,
        refundedAt: '2026-07-23T10:43:00.000Z',
        refundedBy: null,
        amount: 260,
        method: 'CASH',
        deducted: false,
      }],
      saleReturn: {
        id: 1,
        code: 'RT-0001',
        returnedAt: '2026-07-23T10:43:00.000Z',
        reason: 'ทดสอบ',
        employee: null,
        status: 'COMPLETED',
        returnType: 'REFUND',
      },
    }],
    claims: [],
    repairs: [],
    permissions,
  })

  assert.deepEqual(
    events.map((event) => event.title),
    ['รับคืนสินค้าและคืนเข้าพร้อมขาย', 'คืนเงินให้ลูกค้า', 'ขายสินค้า'],
  )
})
