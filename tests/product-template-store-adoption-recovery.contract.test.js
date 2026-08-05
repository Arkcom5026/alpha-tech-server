const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const service = read('src/modules/product/templateClone/services/productTemplateCloneService.js')
const controller = read('src/modules/product/templateClone/controllers/productTemplateCloneController.js')

assert.match(service, /db\.\$transaction\(async \(tx\) =>/)
assert.match(service, /const adoptBranchProductType = async/)
assert.match(service, /findBranchProductTypeByGlobalProductTypeId/)
assert.match(service, /db\.productType\.create/)
assert.match(service, /branchId: Number\(branchId\)/)
assert.match(service, /globalProductTypeId: templateType\.globalProductTypeId/)
assert.match(service, /name: templateType\.name/)
assert.match(service, /if \(error\?\.code !== 'P2002'\) throw error/)
assert.match(service, /templateProductId: tplId/)
assert.match(service, /productTypeId: branchType\.id/)
assert.doesNotMatch(service, /PRODUCT_TYPE_NOT_FOUND_IN_BRANCH/)

assert.match(controller, /TEMPLATE_PRODUCT_TYPE_NOT_FOUND/)
assert.doesNotMatch(controller, /PRODUCT_TYPE_NOT_FOUND_IN_BRANCH/)

console.log('ProductTemplate store adoption recovery contract: PASS')
