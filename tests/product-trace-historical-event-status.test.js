const test = require('node:test')
const assert = require('node:assert/strict')

const {
  buildProductTraceTimeline,
} = require('../src/modules/product/trace/builders/productTraceTimelineBuilder')

const permissions = {
  canViewFinancials: true,
  canViewSupplier: true,
}

test('historical inventory events retain IN_STOCK after the item is sold', () => {
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

  assert.equal(received?.status, 'IN_STOCK')
  assert.equal(scanned?.status, 'IN_STOCK')
})

test('receipt-specific status remains authoritative when available', () => {
  const events = buildProductTraceTimeline({
    stockItem: {
      id: 3805,
      status: 'SOLD',
      receivedAt: new Date('2026-07-06T07:53:00.000Z'),
      scannedAt: null,
    },
    procurement: {
      receipt: {
        id: 12,
        code: 'RC-0012',
        statusReceipt: 'RECEIVED',
        receivedBy: null,
      },
    },
    sales: null,
    returns: [],
    claims: [],
    repairs: [],
    permissions,
  })

  assert.equal(events[0]?.status, 'RECEIVED')
})
