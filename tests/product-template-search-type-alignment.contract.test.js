const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8')

const controllerSource = read('src/modules/product/templateSearch/controllers/templateProductSearchController.js')
const serviceSource = read('src/modules/product/templateSearch/services/templateProductSearchService.js')

assert.match(controllerSource, /sourceBranchId:\s*req\.user\?\.branchId/)
assert.match(serviceSource, /resolveTemplateProductTypeId/)
assert.match(serviceSource, /globalProductTypeId/)
assert.match(serviceSource, /branchId:\s*sourceBranch/)
assert.match(serviceSource, /branchId:\s*templateBranch/)
assert.match(serviceSource, /templateProductTypeId:\s*templateType\?\.id \|\| null/)
assert.match(serviceSource, /if \(typeResolution\.requested && !typeResolution\.templateProductTypeId\) \{\s*return \[\]/)
assert.match(serviceSource, /productTypeId:\s*typeResolution\.templateProductTypeId/)
assert.match(serviceSource, /globalProductTypeId:\s*product\.productType\?\.globalProductTypeId/)

console.log('Product Template Search Type Alignment Contract: PASS')
