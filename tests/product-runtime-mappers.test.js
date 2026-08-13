const assert = require('node:assert/strict')
const {
  toOperationalRuntimeProduct,
} = require('../src/modules/product/runtime/mappers/operationalRuntimeProductMapper')
const {
  toOperationalProductPosSearchItem,
} = require('../src/modules/product/runtime/mappers/operationalProductPosSearchMapper')
const {
  toOperationalProductOnlineSearchItem,
  toOperationalOnlineProductDetail,
} = require('../src/modules/product/runtime/mappers/operationalProductOnlineMapper')
const {
  toOperationalProductDetail,
} = require('../src/modules/product/runtime/mappers/operationalProductDetailMapper')

const baseProduct = {
  id: 21,
  templateProductId: 9021,
  active: true,
  name: 'Simple Product',
  mode: 'SIMPLE',
  inventoryBehavior: 'NON_STOCK',
  saleBarcode: 'SVC-001',
  noSN: true,
  trackSerialNumber: false,
  productTypeId: 8,
  productType: {
    id: 8,
    name: 'Consumable',
    globalProductType: {
      categoryId: 4,
      category: { id: 4, name: 'Supplies' },
    },
  },
  brandId: 3,
  brand: { id: 3, name: 'Brand A' },
  unitId: 2,
  unit: { id: 2, name: 'ชิ้น' },
  branchPrice: [{
    costPrice: 60,
    priceRetail: 100,
    priceWholesale: 90,
    priceTechnician: 95,
    priceOnline: 110,
    isActive: true,
  }],
  stockBalances: [{
    quantity: 10,
    reserved: 2,
    lastReceivedCost: 65,
  }],
  stockItems: [],
  productImages: [],
}

const run = () => {
  const runtime = toOperationalRuntimeProduct(baseProduct, 7)
  assert.equal(runtime.available, 8)
  assert.equal(runtime.inventoryBehavior, 'NON_STOCK')
  assert.equal(runtime.saleBarcode, 'SVC-001')
  assert.equal(runtime.branchId, 7)
  assert.equal(runtime.categoryName, 'Supplies')

  const pos = toOperationalProductPosSearchItem(baseProduct)
  assert.equal(pos.available, 8)
  assert.equal(pos.inventoryBehavior, 'NON_STOCK')
  assert.equal(pos.isReady, true)
  assert.equal(pos.lastCost, 65)
  assert.equal(pos.templateProductId, 9021)

  const online = toOperationalProductOnlineSearchItem(baseProduct)
  assert.equal(online.readyPickupAtBranch, true)
  assert.equal(online.inventoryBehavior, 'NON_STOCK')
  assert.equal(online.saleBarcode, 'SVC-001')
  assert.equal(online.priceOnlineEffective, 110)

  const detail = toOperationalProductDetail(baseProduct)
  assert.equal(detail.available, 8)
  assert.equal(detail.saleBarcode, 'SVC-001')
  assert.equal(detail.isReady, true)
  assert.equal(detail.productTypeName, 'Consumable')

  const onlineDetail = toOperationalOnlineProductDetail(baseProduct)
  assert.equal(onlineDetail.readyPickupAtBranch, true)
  assert.equal(onlineDetail.inventoryBehavior, 'NON_STOCK')
  assert.equal(onlineDetail.saleBarcode, 'SVC-001')
  assert.equal(onlineDetail.unitName, 'ชิ้น')

  console.log('Operational Product Runtime Mappers: PASS')
}

try {
  run()
} catch (error) {
  console.error('Operational Product Runtime Mappers: FAIL')
  console.error(error)
  process.exitCode = 1
}
