const assert = require('node:assert/strict')
const {
  prepareMixedSaleEvidence,
  productInventoryBehavior,
} = require('../src/modules/sales/completion/services/saleCompletionService')

assert.equal(
  productInventoryBehavior({
    inventoryBehavior: 'TRACKED',
    productConfig: { inventoryBehavior: 'NON_STOCK' },
  }),
  'TRACKED'
)
assert.equal(
  productInventoryBehavior({
    inventoryBehavior: 'NON_STOCK',
    productConfig: { inventoryBehavior: 'TRACKED' },
  }),
  'NON_STOCK'
)
assert.equal(
  productInventoryBehavior({ productConfig: { inventoryBehavior: 'NON_STOCK' } }),
  'NON_STOCK'
)
assert.equal(productInventoryBehavior({}), 'TRACKED')

const makeTx = ({ product, lot, balance }) => {
  const calls = { productWhere: null, lot: 0, balance: 0 }
  return {
    calls,
    stockItem: { findMany: async () => [] },
    product: {
      findMany: async (args) => {
        calls.productWhere = args.where
        return product ? [product] : []
      },
    },
    simpleLot: {
      findMany: async () => {
        calls.lot += 1
        return lot ? [lot] : []
      },
    },
    stockBalance: {
      findMany: async () => {
        calls.balance += 1
        return balance ? [balance] : []
      },
    },
  }
}

const nonStockTx = makeTx({
  product: { id: 10, mode: 'SIMPLE', inventoryBehavior: 'NON_STOCK' },
})
prepareMixedSaleEvidence({
  tx: nonStockTx,
  branchId: 7,
  items: [{
    lineId: 'simple-10',
    lineType: 'SIMPLE',
    productId: 10,
    simpleLotId: null,
    quantity: 2,
  }],
}).then((evidence) => {
  assert.equal(evidence.nonStockSimpleLines.length, 1)
  assert.equal(evidence.trackedSimpleLines.length, 0)
  assert.equal(evidence.requiredByLot.size, 0)
  assert.equal(evidence.requiredByProduct.size, 0)
  assert.equal(nonStockTx.calls.lot, 0)
  assert.equal(nonStockTx.calls.balance, 0)
  assert.deepEqual(nonStockTx.calls.productWhere.productType, { branchId: 7 })
  assert.deepEqual(nonStockTx.calls.productWhere.branchPrice, {
    some: { branchId: 7, isActive: true },
  })

  const trackedTx = makeTx({
    product: { id: 11, mode: 'SIMPLE', inventoryBehavior: 'TRACKED' },
    lot: { id: 91, productId: 11, branchId: 7, qtyRemaining: 5 },
    balance: { id: 1, productId: 11, quantity: 5, reserved: 0 },
  })
  return prepareMixedSaleEvidence({
    tx: trackedTx,
    branchId: 7,
    items: [{
      lineId: 'simple-11',
      lineType: 'SIMPLE',
      productId: 11,
      simpleLotId: 91,
      quantity: 2,
    }],
  }).then((tracked) => {
    assert.equal(tracked.trackedSimpleLines.length, 1)
    assert.equal(tracked.nonStockSimpleLines.length, 0)
    assert.equal(tracked.requiredByLot.get(91), 2)
    assert.equal(tracked.requiredByProduct.get(11), 2)
    assert.equal(trackedTx.calls.lot, 1)
    assert.equal(trackedTx.calls.balance, 1)
    console.log('Sale SIMPLE Inventory Authority: PASS')
  })
}).catch((error) => {
  console.error('Sale SIMPLE Inventory Authority: FAIL')
  console.error(error)
  process.exitCode = 1
})
