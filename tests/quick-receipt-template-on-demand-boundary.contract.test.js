'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8')

const quickStockServiceSource = read('src/modules/product/quickStock/services/QuickStockService.js')
const quickStockRepositorySource = read('src/modules/product/quickStock/repositories/quickStockRepository.js')
const templateCloneSource = read('src/modules/product/templateClone/services/productTemplateCloneService.js')

assert.match(quickStockServiceSource, /async quickReceiveExistingProduct\(/)
assert.match(quickStockServiceSource, /findProductForReceive\(\{ db: tx, productId, branchId: authority\.branchId \}\)/)
assert.match(quickStockServiceSource, /PRODUCT_NOT_FOUND_IN_BRANCH/)
assert.doesNotMatch(quickStockServiceSource, /cloneProductFromTemplate/)
assert.doesNotMatch(quickStockServiceSource, /productTemplateEngine/)
assert.doesNotMatch(quickStockServiceSource, /templateProductId/)

assert.match(quickStockRepositorySource, /async findOperationalProductInBranch\(/)
assert.match(quickStockRepositorySource, /productType:\s*\{ branchId: brId \}/)
assert.match(quickStockRepositorySource, /async findProductForReceive\([\s\S]*findOperationalProductInBranch/)

assert.match(templateCloneSource, /cloneOperationalProductFromTemplate/)
assert.match(templateCloneSource, /findOperationalRuntimeProductByTemplateId/)

console.log('Quick Receipt Template-on-Demand Boundary Contract: PASS')
