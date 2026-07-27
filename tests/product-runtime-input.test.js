const assert = require('node:assert/strict')
const {
  normStr,
  pickBranchPricePayload,
  toInt,
  toNum,
} = require('../src/modules/product/runtime/shared/operationalProductInput')

const run = () => {
  assert.equal(toInt('42'), 42)
  assert.equal(toInt(''), undefined)
  assert.equal(toNum('1,250.50'), 1250.5)
  assert.equal(toNum('not-a-number'), undefined)
  assert.equal(normStr('  Product  '), 'Product')
  assert.equal(normStr(null), '')

  assert.deepEqual(
    pickBranchPricePayload({
      branchPrice: {
        costPrice: 100,
        priceRetail: 150,
        isActive: true,
      },
      costPrice: 999,
    }),
    {
      costPrice: 100,
      priceRetail: 150,
      isActive: true,
    }
  )

  assert.deepEqual(
    pickBranchPricePayload({
      costPrice: 80,
      priceRetail: 120,
      branchPriceActive: false,
    }),
    {
      costPrice: 80,
      priceRetail: 120,
      priceWholesale: undefined,
      priceTechnician: undefined,
      priceOnline: undefined,
      isActive: false,
    }
  )

  assert.equal(pickBranchPricePayload({ name: 'No price' }), null)

  console.log('Operational Product Input: PASS')
}

try {
  run()
} catch (error) {
  console.error('Operational Product Input: FAIL')
  console.error(error)
  process.exitCode = 1
}
