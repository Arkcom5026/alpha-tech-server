const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8')

const serviceSource = read('src/modules/product/templateClone/services/productTemplateCloneService.js')
const controllerSource = read('src/modules/product/templateClone/controllers/productTemplateCloneController.js')

assert.match(serviceSource, /normalizeTaxonomyLabel/)
assert.match(serviceSource, /isTaxonomyLabelCompatible/)
assert.match(serviceSource, /assertProductTypeGlobalMappingIntegrity/)
assert.match(serviceSource, /PRODUCT_TYPE_GLOBAL_MAPPING_CONFLICT/)
assert.match(serviceSource, /GLOBAL_PRODUCT_TYPE_AUTHORITY_MISSING/)
assert.match(serviceSource, /GLOBAL_PRODUCT_TYPE_ID_MISMATCH/)
assert.match(serviceSource, /TEMPLATE_PRODUCT_TYPE_SEMANTIC_DRIFT/)
assert.match(serviceSource, /BRANCH_PRODUCT_TYPE_SEMANTIC_DRIFT/)

assert.match(serviceSource, /globalProductType:\s*\{[\s\S]*name:\s*true/)
assert.match(serviceSource, /const templateType = await db\.productType\.findFirst/)
assert.match(serviceSource, /const existing = await db\.productType\.findFirst/)
assert.match(serviceSource, /assertProductTypeGlobalMappingIntegrity\(\{[\s\S]*templateType,[\s\S]*branchType: existing/)
assert.match(serviceSource, /assertProductTypeGlobalMappingIntegrity\(\{[\s\S]*branchType: created/)
assert.match(serviceSource, /assertProductTypeGlobalMappingIntegrity\(\{[\s\S]*branchType: concurrent/)

const integrityIndex = serviceSource.indexOf('const branchType = await adoptBranchProductType')
const createIndex = serviceSource.indexOf('const created = await createOperationalProductRecordFromTemplate')
assert.ok(integrityIndex >= 0 && createIndex > integrityIndex, 'type integrity must run before Product creation')

assert.match(controllerSource, /error\?\.details \? \{ details: error\.details \} : \{\}/)
assert.match(controllerSource, /status >= 400 && status < 500/)

console.log('Product Template Clone Type Integrity Contract: PASS')
