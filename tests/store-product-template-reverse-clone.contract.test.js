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

// Runtime routing authority: Store branch category is not catalog truth.
// Product -> ProductType -> GlobalProductType.categoryId selects the matching Template Store.
assert.match(reverseCloneSource, /productCategoryId = Number\(sourceProduct\?\.productType\?\.globalProductType\?\.categoryId\)/)
assert.match(reverseCloneSource, /SOURCE_PRODUCT_GLOBAL_CATEGORY_REQUIRED/)
assert.match(reverseCloneSource, /categoryId: productCategoryId/)
assert.match(reverseCloneSource, /branchCode: \{ startsWith: 'T' \}/)
assert.match(reverseCloneSource, /PRODUCT_TEMPLATE_CATEGORY_MISMATCH/)
assert.match(reverseCloneSource, /sourceBranchCategoryId: sourceBranch\.categoryId/)
assert.doesNotMatch(reverseCloneSource, /Number\(templateBranch\.categoryId\) !== Number\(sourceBranch\.categoryId\)/)
assert.doesNotMatch(reverseCloneSource, /SOURCE_TEMPLATE_CATEGORY_MISMATCH/)

// GENERAL stores are allowed to fall back to the catalog Template branch when taxonomy matches.
assert.match(reverseCloneSource, /\[preferredBranchCode, DEFAULT_TEMPLATE_BRANCH_CODE\]/)
assert.match(reverseCloneSource, /resolveTemplateBranchCode\(sourceBranch\.businessType\)/)

// Product must be loaded before Template Store resolution so Global taxonomy is available.
const routingProductIndex = reverseCloneSource.indexOf('const routingProduct = await findSourceProduct')
const branchResolutionIndex = reverseCloneSource.indexOf('const branchResolution = await resolveMatchingTemplateBranch', routingProductIndex)
assert.ok(routingProductIndex > 0, 'source Product must be loaded for taxonomy routing')
assert.ok(branchResolutionIndex > routingProductIndex, 'Template Store resolution must occur after source Product taxonomy is loaded')
assert.match(reverseCloneSource, /sourceProduct: routingProduct/)
assert.match(reverseCloneSource, /SOURCE_PRODUCT_CATEGORY_CHANGED_DURING_SYNC/)

assert.match(reverseCloneSource, /normalizeCatalogText/)
assert.match(reverseCloneSource, /buildCatalogFingerprint/)
assert.match(reverseCloneSource, /globalProductTypeId/)
assert.match(reverseCloneSource, /brand\?\.normalizedName \|\| product\?\.brand\?\.name/)
assert.match(reverseCloneSource, /findExactTemplateProduct/)
assert.match(reverseCloneSource, /status: 'MATCHED_UNLINKED'/)
assert.match(reverseCloneSource, /status: 'LINKED_TEMPLATE'/)

assert.match(reverseCloneSource, /buildReverseCloneLockKey/)
assert.match(reverseCloneSource, /acquireReverseCloneFingerprintLock/)
assert.match(reverseCloneSource, /product-template-reverse-clone:/)
assert.match(reverseCloneSource, /pg_advisory_xact_lock\(hashtext\(\$1\)\)/)
assert.match(reverseCloneSource, /\$queryRawUnsafe/)
assert.match(reverseCloneSource, /SOURCE_PRODUCT_FINGERPRINT_REQUIRED/)

const acquireLockIndex = reverseCloneSource.indexOf('await acquireReverseCloneFingerprintLock')
const lockedReadIndex = reverseCloneSource.indexOf('const product = await findSourceProduct', acquireLockIndex)
const exactMatchIndex = reverseCloneSource.indexOf('const exactTemplate = await findExactTemplateProduct', lockedReadIndex)
const createTemplateIndex = reverseCloneSource.indexOf('const templateProduct = await tx.product.create', exactMatchIndex)
assert.ok(acquireLockIndex > 0, 'reverse clone must acquire catalog fingerprint lock')
assert.ok(lockedReadIndex > acquireLockIndex, 'source Product must be re-read after lock acquisition')
assert.ok(exactMatchIndex > lockedReadIndex, 'exact Template match must be re-checked after locked re-read')
assert.ok(createTemplateIndex > exactMatchIndex, 'Template Product creation must happen only after locked exact-match recheck')

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
