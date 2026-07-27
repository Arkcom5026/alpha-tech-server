const assert = require('node:assert/strict')

const { QuickStockRepository } = require('./quickStockRepository')

const updates = []
const creates = []
const client = {
  $queryRawUnsafe: async () => [{ id: 9, quantity: '10', avgCost: '100' }],
  stockBalance: {
    update: async (command) => {
      updates.push(command)
      return command
    },
    create: async (command) => {
      creates.push(command)
      return command
    },
  },
}

const repository = new QuickStockRepository(client)

;(async () => {
  await repository.upsertStockBalance({
    productId: 101,
    branchId: 7,
    quantity: 5,
    lastReceivedCost: 160,
  })

  assert.equal(updates.length, 1)
  assert.equal(creates.length, 0)
  assert.equal(updates[0].where.id, 9)
  assert.equal(updates[0].data.quantity, 15)
  assert.equal(updates[0].data.lastReceivedCost, 160)
  assert.equal(updates[0].data.avgCost, 120)

  const emptyClient = {
    $queryRawUnsafe: async () => [],
    stockBalance: {
      update: async () => assert.fail('must not update a missing balance'),
      create: async (command) => command,
    },
  }
  const emptyRepository = new QuickStockRepository(emptyClient)
  const created = await emptyRepository.upsertStockBalance({
    productId: 202,
    branchId: 7,
    quantity: 3,
    lastReceivedCost: 75.5,
  })

  assert.deepEqual(created.data, {
    productId: 202,
    branchId: 7,
    quantity: 3,
    reserved: 0,
    lastReceivedCost: 75.5,
    avgCost: 75.5,
  })

  console.log('✅ QuickStockRepository weighted average cost contract passed')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
