'use strict'

const assert = require('assert')
const { getReadyToSell } = require('../src/modules/product/readyToSell/services/readyToSellService')

const activePrice = {
  priceRetail: 150,
  priceWholesale: 140,
  priceTechnician: 130,
  priceOnline: 145,
}

const calls = []
const db = {
  stockItem: {
    groupBy: async (args) => {
      calls.push(['stockItem.groupBy', args])
      return [
        { productId: 10, _count: { _all: 2 }, _max: { receivedAt: new Date('2026-08-18T08:00:00.000Z') } },
        { productId: 20, _count: { _all: 1 }, _max: { receivedAt: new Date('2026-08-18T07:00:00.000Z') } },
        { productId: 30, _count: { _all: 1 }, _max: { receivedAt: new Date('2026-08-18T06:00:00.000Z') } },
      ]
    },
    findMany: async (args) => {
      calls.push(['stockItem.findMany', args])
      assert.deepStrictEqual(args.where.productId.in, [10])
      return [
        { productId: 10, barcode: 'SELLABLE-10', receivedAt: new Date('2026-08-18T08:00:00.000Z'), createdAt: new Date('2026-08-18T08:00:00.000Z') },
      ]
    },
  },
  product: {
    findMany: async (args) => {
      calls.push(['product.findMany', args])

      if (args.where?.id?.in) {
        assert.deepStrictEqual(args.where.id.in, [10, 20, 30])
        assert.deepStrictEqual(args.where.branchPrice, {
          some: { branchId: 14, isActive: true },
        })

        // Product 20 has stock, but no active branch price. Prisma would exclude it.
        // Product 30 has an active row, but wholesale price is ineffective (0).
        return [
          {
            id: 10,
            name: 'Sellable product',
            brandId: null,
            brand: null,
            unitId: null,
            unit: null,
            branchPrice: [activePrice],
          },
          {
            id: 30,
            name: 'Ineffective wholesale price',
            brandId: null,
            brand: null,
            unitId: null,
            unit: null,
            branchPrice: [{ ...activePrice, priceWholesale: 0 }],
          },
        ]
      }

      // SIMPLE lookup for mode ALL.
      return []
    },
  },
}

;(async () => {
  const result = await getReadyToSell({ branchId: 14, db })

  assert.strictEqual(result.total, 1)
  assert.strictEqual(result.items.length, 1)
  assert.strictEqual(result.items[0].productId, 10)
  assert.strictEqual(result.items[0].displayCode, 'หลายบาร์โค้ด')
  assert.deepStrictEqual(result.items[0].prices, {
    retail: { price: 150, priceType: 'retail', field: 'priceRetail' },
    wholesale: { price: 140, priceType: 'wholesale', field: 'priceWholesale' },
    technician: { price: 130, priceType: 'technician', field: 'priceTechnician' },
    online: { price: 145, priceType: 'online', field: 'priceOnline' },
  })

  assert.ok(calls.some(([name]) => name === 'stockItem.groupBy'))
  assert.ok(calls.some(([name]) => name === 'stockItem.findMany'))

  console.log('ready-to-sell-missing-price-isolation.contract.test.js: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
