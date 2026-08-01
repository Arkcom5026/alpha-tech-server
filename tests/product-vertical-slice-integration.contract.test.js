const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const resolve = (relativePath) => path.join(root, relativePath)
const read = (relativePath) => fs.readFileSync(resolve(relativePath), 'utf8')
const exists = (relativePath) => fs.existsSync(resolve(relativePath))

const requiredFiles = [
  'src/modules/product/routes/productRoutes.js',
  'src/modules/product/create/controllers/productCreatePosCompatibilityController.js',
  'src/modules/product/create/services/productCreateCompatibilityService.js',
  'src/modules/product/create/services/productCreateService.js',
  'src/modules/product/posQuery/controllers/productPosQueryController.js',
  'src/modules/product/posQuery/services/productPosQueryService.js',
  'src/modules/product/onlineQuery/controllers/productOnlineQueryController.js',
  'src/modules/product/onlineQuery/services/productOnlineQueryService.js',
  'src/modules/product/runtimeLookup/controllers/productRuntimeLookupController.js',
  'src/modules/product/runtimeLookup/services/productRuntimeLookupService.js',
  'src/modules/product/templateClone/services/productTemplateCloneService.js',
  'src/modules/product/readyToSell/services/readyToSellService.js',
  'src/modules/product/inventoryLookup/services/productInventoryLookupService.js',
]

for (const file of requiredFiles) {
  assert.equal(exists(file), true, `Required Product slice file is missing: ${file}`)
}

const forbiddenFiles = [
  'routes/productRoutes.js',
  'src/modules/product/runtime/controllers/operationalProductRuntimeController.js',
  'src/modules/product/runtime/services/operationalProductRuntimeService.js',
  'src/modules/product/controllers/operationalProductRuntimeController.js',
]

for (const file of forbiddenFiles) {
  assert.equal(exists(file), false, `Retired Product runtime file must remain absent: ${file}`)
}

const productModule = read('src/modules/product/index.js')
assert.match(productModule, /require\('\.\/routes\/productRoutes'\)/)
assert.doesNotMatch(productModule, /require\('\.\.\/\.\.\/\.\.\/routes\/productRoutes'\)/)

const route = read('src/modules/product/routes/productRoutes.js')
assert.match(route, /productPosQueryController\.searchProducts/)
assert.match(route, /productOnlineQueryController\.searchProducts/)
assert.match(route, /productRuntimeLookupController\.getOperationalProductByTemplateId/)
assert.match(route, /productCreatePosCompatibilityController\.createLocalOperationalProduct/)
assert.match(route, /productTemplateCloneController\.createOperationalProductFromTemplate/)
assert.match(route, /readyToSellController\.getReadyToSellProducts/)
assert.doesNotMatch(route, /operationalProductRuntimeController/)

const ownershipFiles = [
  'src/modules/product/create/services/productCreateCompatibilityService.js',
  'src/modules/product/posQuery/services/productPosQueryService.js',
  'src/modules/product/onlineQuery/services/productOnlineQueryService.js',
  'src/modules/product/runtimeLookup/services/productRuntimeLookupService.js',
  'src/modules/product/templateClone/services/productTemplateCloneService.js',
  'src/modules/product/readyToSell/services/readyToSellService.js',
  'src/modules/product/inventoryLookup/services/productInventoryLookupService.js',
]

for (const file of ownershipFiles) {
  assert.doesNotMatch(
    read(file),
    /operationalProductRuntimeService/,
    `${file} must not delegate back to the removed broad runtime service`
  )
}

assert.match(read('src/modules/product/posQuery/controllers/productPosQueryController.js'), /productPosQueryService/)
assert.match(read('src/modules/product/onlineQuery/controllers/productOnlineQueryController.js'), /productOnlineQueryService/)
assert.match(read('src/modules/product/runtimeLookup/controllers/productRuntimeLookupController.js'), /productRuntimeLookupService/)
assert.match(read('src/modules/product/create/controllers/productCreatePosCompatibilityController.js'), /productCreateCompatibilityService/)

console.log('Product vertical-slice integration contract: PASS')
