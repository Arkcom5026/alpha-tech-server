const test = require('node:test')
const assert = require('node:assert/strict')
const { buildProductTraceSummary } = require('../src/modules/product/trace/builders/productTraceSummaryBuilder')

const permissions = { canViewFinancials: true }

test('full return reverses revenue and recognized cost', () => {
  const summary = buildProductTraceSummary({
    stockItem: {
      costPrice: 235,
      saleItems: [{ id: 10, price: 260, basePrice: 260, discount: 0 }],
    },
    returns: [{ saleItemId: 10, refundAmount: 260 }],
    permissions,
  })

  assert.equal(summary.netRevenueAfterRefund, 0)
  assert.equal(summary.grossProfitAfterRefund, 0)
  assert.equal(summary.grossMarginPercentAfterRefund, null)
})

test('sale-return-resale retains cost only for active sale cycle', () => {
  const summary = buildProductTraceSummary({
    stockItem: {
      costPrice: 235,
      saleItems: [
        { id: 10, price: 260, basePrice: 260, discount: 0 },
        { id: 11, price: 300, basePrice: 300, discount: 0 },
      ],
    },
    returns: [{ saleItemId: 10, refundAmount: 260 }],
    permissions,
  })

  assert.equal(summary.netSale, 560)
  assert.equal(summary.refundTotal, 260)
  assert.equal(summary.netRevenueAfterRefund, 300)
  assert.equal(summary.grossProfitBeforeRefund, 90)
  assert.equal(summary.grossProfitAfterRefund, 65)
})
