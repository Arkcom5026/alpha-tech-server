const assert = require('node:assert/strict')
const {
  calcAvailable,
  isReadyProduct,
  isSimpleProduct,
} = require('../src/modules/product/runtime/calculations/operationalStockAvailability')

const run = () => {
  assert.deepEqual(calcAvailable(null), {
    quantity: 0,
    reserved: 0,
    available: 0,
  })

  assert.deepEqual(calcAvailable({ quantity: 10, reserved: 3 }), {
    quantity: 10,
    reserved: 3,
    available: 7,
  })

  assert.deepEqual(calcAvailable({ quantity: 2, reserved: 5 }), {
    quantity: 2,
    reserved: 5,
    available: 0,
  })

  assert.equal(isSimpleProduct({ mode: 'SIMPLE' }), true)
  assert.equal(isSimpleProduct({ mode: 'STRUCTURED', noSN: false }), false)
  assert.equal(isReadyProduct({ mode: 'SIMPLE' }, 1), true)
  assert.equal(isReadyProduct({ mode: 'SIMPLE' }, 0), false)
  assert.equal(
    isReadyProduct({
      mode: 'SIMPLE',
      inventoryBehavior: 'NON_STOCK',
      active: true,
      branchPrice: [{ id: 1 }],
    }, 0),
    true
  )
  assert.equal(
    isReadyProduct({
      mode: 'SIMPLE',
      inventoryBehavior: 'NON_STOCK',
      active: true,
      branchPrice: [],
    }, 0),
    false
  )
  assert.equal(
    isReadyProduct({ mode: 'STRUCTURED', stockItems: [{ id: 1 }] }, 0),
    true
  )
  assert.equal(isReadyProduct({ mode: 'STRUCTURED', stockItems: [] }, 10), false)

  console.log('Operational Stock Availability: PASS')
}

try {
  run()
} catch (error) {
  console.error('Operational Stock Availability: FAIL')
  console.error(error)
  process.exitCode = 1
}
