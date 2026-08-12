const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8')

const reverseCloneSource = read('src/modules/product/templateReverseClone/services/storeProductTemplateReverseCloneService.js')
const createServiceSource = read('src/modules/product/create/services/productCreateService.js')

assert.match(reverseCloneSource, /BUSINESS_TYPE_TEMPLATE_BRANCH_CODE/)
assert.match(reverseCloneSource, /\[BusinessType\.IT\]: DEFAULT_TEMPLATE_BRANCH_CODE/)
assert.match(reverseCloneSource, /resolveMatchingTemplateBranch/)
assert.match(reverseCloneSource, /sourceBranch\.businessType/)
assert.match(reverseCloneSource, /SOURCE_TEMPLATE_CATEGORY_MISMATCH/)

assert.match(reverseCloneSource, /normalizeCatalogText/)
assert.match(reverseCloneSource, /buildCatalogFingerprint/)
assert.match(reverseCloneSource, /globalProductTypeId/)
assert.match(reverseCloneSource, /brand\?\.normalizedName \|\| product\?\.brand\?\.name/)
assert.match(reverseCloneSource, /findExactTemplateProduct/)
assert.match(reverseCloneSource, /status: 'MATCHED_UNLINKED'/)
assert.match(reverseCloneSource, /status: 'LINKED_TEMPLATE'/)

assert.match(reverseCloneSource, /ensureTemplateProductType/)
assert.match(reverseCloneSource, /isTaxonomyLabelCompatible/)
assert.match(reverseCloneSource, /PRODUCT_TYPE_GLOBAL_MAPPING_CONFLICT/)
assert.match(reverseCloneSource, /ensureTemplateProductTypeBrand/)
assert.match(reverseCloneSource, /resolveTemplateSaleBarcode/)
assert.match(reverseCloneSource, /cloneSourceBranchPriceToTemplate/)
assert.match(reverseCloneSource, /Reverse cloned from Store Product/)

assert.match(reverseCloneSource, /branchId: Number\(templateBranchId\)/)
assert.match(reverseCloneSource, /name: product\.name/)
assert.match(reverseCloneSource, /mode: product\.mode/)
assert.match(reverseCloneSource, /inventoryBehavior: product\.inventoryBehavior/)
assert.match(reverseCloneSource, /brandId: product\.brandId \|\| null/)
assert.match(reverseCloneSource, /unitId: product\.unitId \|\| null/)
assert.match(reverseCloneSource, /codeType: product\.codeType \|\| null/)
assert.match(reverseCloneSource, /productConfig: product\.productConfig/)
assert.match(reverseCloneSource, /warrantyDays: product\.warrantyDays \|\| null/)

assert.match(reverseCloneSource, /linkSourceProductToTemplate/)
assert.match(reverseCloneSource, /data: \{ templateProductId: Number\(templateProductId\) \}/)
assert.match(reverseCloneSource, /status: 'REVERSE_CLONED'/)
assert.match(reverseCloneSource, /created: true/)

assert.match(createServiceSource, /reverseCloneStoreProductToMatchingTemplate/)
assert.match(createServiceSource, /sourceProductId: result\.product\.id/)
assert.match(createServiceSource, /templateSync = await reverseCloneStoreProductToMatchingTemplate/)
assert.match(createServiceSource, /status: 'FAILED'/)
assert.match(createServiceSource, /templateSync,/)

const forbiddenCandidateDependency = /productTemplateCandidate|productTemplate\/candidates|\.\.\/candidates|createCandidate|promoteCandidate|materializeDiscovery/
assert.doesNotMatch(reverseCloneSource, forbiddenCandidateDependency)
assert.doesNotMatch(createServiceSource, forbiddenCandidateDependency)

console.log('Store Product Template Reverse Clone Contract: PASS')
