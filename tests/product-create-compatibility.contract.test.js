const assert = require('node:assert/strict')
const path = require('node:path')

const createServicePath = path.resolve(
  __dirname,
  '../src/modules/product/create/services/productCreateService.js'
)
const compatibilityServicePath = path.resolve(
  __dirname,
  '../src/modules/product/create/services/productCreateCompatibilityService.js'
)

const loadCompatibilityService = (createServiceOverrides) => {
  delete require.cache[compatibilityServicePath]
  require.cache[createServicePath] = {
    id: createServicePath,
    filename: createServicePath,
    loaded: true,
    exports: createServiceOverrides,
    children: [],
    paths: [],
  }
  return require(compatibilityServicePath)
}

const run = async () => {
  let receivedInput = null

  const compatibility = loadCompatibilityService({
    createLocalOperationalProduct: async (input) => {
      receivedInput = input
      return {
        success: true,
        product: {
          id: 101,
          name: 'Local Product',
          productTypeId: 8,
          brandId: 3,
          unitId: 2,
          mode: 'SIMPLE',
          noSN: true,
          trackSerialNumber: false,
          active: true,
          productType: {
            id: 8,
            name: 'SSD',
            globalProductType: {
              categoryId: 4,
              category: { id: 4, name: 'Storage' },
            },
          },
          brand: { id: 3, name: 'Brand A' },
          unit: { id: 2, name: 'ชิ้น' },
        },
        branchPrice: {
          id: 55,
          costPrice: 100,
          priceRetail: 150,
          priceWholesale: 140,
          priceTechnician: 135,
          priceOnline: 160,
          isActive: true,
        },
        runtime: {
          branchId: 7,
          flow: 'PRODUCT_CREATE_RUNTIME',
        },
      }
    },
  })

  const result = await compatibility.createLocalOperationalProductForLegacyRuntime({
    branchId: 7,
    employeeId: 22,
    data: { name: 'Local Product' },
  })

  assert.deepEqual(receivedInput, {
    branchId: 7,
    employeeId: 22,
    data: { name: 'Local Product' },
  })

  assert.equal(result.success, true)
  assert.equal(result.created, true)
  assert.equal(result.branchId, 7)
  assert.equal(result.product.id, 101)
  assert.equal(result.product.costPrice, 100)
  assert.equal(result.product.priceRetail, 150)
  assert.equal(result.product.priceWholesale, 140)
  assert.equal(result.product.priceTechnician, 135)
  assert.equal(result.product.priceOnline, 160)
  assert.equal(result.product.branchPriceActive, true)
  assert.equal(result.product.hasPrice, true)
  assert.equal(result.product.available, 0)
  assert.equal(result.product.stockBalance, null)
  assert.equal(result.product.categoryId, 4)
  assert.equal(result.product.categoryName, 'Storage')
  assert.equal(result.product.productTypeName, 'SSD')
  assert.deepEqual(result.product.branchPrice, [result.product.branchPrice[0]])
  assert.deepEqual(result.data, result.product)

  delete require.cache[compatibilityServicePath]
  delete require.cache[createServicePath]

  console.log('Product Create Compatibility Contract: PASS')
}

run().catch((error) => {
  console.error('Product Create Compatibility Contract: FAIL')
  console.error(error)
  process.exitCode = 1
})
