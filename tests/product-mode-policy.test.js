const assert = require('node:assert/strict')
const {
  decideOperationalProductMode,
} = require('../src/modules/product/runtime/policies/operationalProductModePolicy')

const expectPolicyError = (input, expectedCode) => {
  assert.throws(
    () => decideOperationalProductMode(input),
    (error) => error?.code === expectedCode && error?.statusCode === 400
  )
}

const run = () => {
  assert.deepEqual(decideOperationalProductMode({}), {
    mode: 'SIMPLE',
    noSN: true,
    trackSerialNumber: false,
    inventoryBehavior: 'TRACKED',
  })

  assert.deepEqual(
    decideOperationalProductMode({
      mode: 'SIMPLE',
      inventoryBehavior: 'NON_STOCK',
    }),
    {
      mode: 'SIMPLE',
      noSN: true,
      trackSerialNumber: false,
      inventoryBehavior: 'NON_STOCK',
    }
  )

  assert.deepEqual(decideOperationalProductMode({ mode: 'STRUCTURED' }), {
    mode: 'STRUCTURED',
    noSN: false,
    trackSerialNumber: true,
    inventoryBehavior: 'TRACKED',
  })

  expectPolicyError(
    { mode: 'STRUCTURED', inventoryBehavior: 'NON_STOCK' },
    'NON_STOCK_REQUIRES_SIMPLE_MODE'
  )

  expectPolicyError(
    { mode: 'SIMPLE', inventoryBehavior: 'UNKNOWN' },
    'INVALID_PRODUCT_INVENTORY_BEHAVIOR'
  )

  console.log('Operational Product Mode Policy: PASS')
}

try {
  run()
} catch (error) {
  console.error('Operational Product Mode Policy: FAIL')
  console.error(error)
  process.exitCode = 1
}
