const assert = require('assert')
const fs = require('fs')
const path = require('path')

const read = (relativePath) =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')

const routes = read('src/modules/productTemplate/candidates/routes/productTemplateCandidateRoutes.js')
const mergeRepository = read(
  'src/modules/productTemplate/candidates/promotion/merge/mergeProductTemplateCandidateRepository.js'
)
const mergeService = read(
  'src/modules/productTemplate/candidates/promotion/merge/mergeProductTemplateCandidateService.js'
)
const promoteRepository = read(
  'src/modules/productTemplate/candidates/promotion/promote/promoteProductTemplateCandidateRepository.js'
)
const promoteService = read(
  'src/modules/productTemplate/candidates/promotion/promote/promoteProductTemplateCandidateService.js'
)

// Route and authority boundary.
assert.match(routes, /router\.use\(verifyToken\)/)
assert.match(routes, /router\.use\(requireSuperAdmin\)/)
assert.match(routes, /router\.post\('\/:id\/merge',\s*mergeProductTemplateCandidate\)/)
assert.match(routes, /router\.post\('\/:id\/promote',\s*promoteProductTemplateCandidate\)/)

// Merge is an atomic terminal decision and never mutates the target template Product.
assert.match(mergeRepository, /prisma\.\$transaction\(async \(tx\) =>/)
assert.match(mergeRepository, /status:\s*'UNDER_REVIEW'/)
assert.match(mergeRepository, /targetTemplateProductId:\s*null/)
assert.match(mergeRepository, /status:\s*'MERGED'/)
assert.match(mergeRepository, /eventType:\s*'MERGED'/)
assert.match(mergeRepository, /previousStatus:\s*'UNDER_REVIEW'/)
assert.match(mergeRepository, /resultingStatus:\s*'MERGED'/)
assert.match(mergeRepository, /productType:\s*\{\s*branchId:\s*candidateBefore\.targetTemplateBranchId\s*\}/s)
assert.doesNotMatch(mergeRepository, /tx\.product\.(update|updateMany|upsert|delete|deleteMany)\s*\(/)
assert.match(mergeService, /TARGET_TEMPLATE_PRODUCT_INVALID/)
assert.match(mergeService, /CANDIDATE_MERGE_TRANSITION_CONFLICT/)

// Promote validates Template Branch ownership and performs all writes atomically.
assert.match(promoteRepository, /prisma\.\$transaction\(async \(tx\) =>/)
assert.match(promoteRepository, /candidate\.status !== 'UNDER_REVIEW'/)
assert.match(promoteRepository, /tx\.productType\.findFirst\(/)
assert.match(promoteRepository, /branchId:\s*candidate\.targetTemplateBranchId/)
assert.match(promoteRepository, /tx\.productTemplateCandidate\.updateMany\(/)
assert.match(promoteRepository, /status:\s*'PROMOTED'/)
assert.match(promoteRepository, /tx\.product\.create\(/)
assert.match(promoteRepository, /branchId:\s*candidate\.targetTemplateBranchId/)
assert.match(promoteRepository, /targetTemplateProductId:\s*templateProduct\.id/)
assert.match(promoteRepository, /eventType:\s*'PROMOTED'/)
assert.match(promoteRepository, /previousStatus:\s*'UNDER_REVIEW'/)
assert.match(promoteRepository, /resultingStatus:\s*'PROMOTED'/)
assert.match(promoteService, /TEMPLATE_PRODUCT_TYPE_INVALID/)
assert.match(promoteService, /CANDIDATE_PROMOTE_TRANSITION_CONFLICT/)

// Catalog-safe allowlist: only these Product fields may be written by promotion.
const productCreateBlock = promoteRepository.match(
  /const templateProduct = await tx\.product\.create\(\{([\s\S]*?)\n\s*\}\)\n/
)
assert(productCreateBlock, 'Expected Product create block')
const productCreateSource = productCreateBlock[1]
const allowedProductFields = [
  'branchId',
  'name',
  'active',
  'mode',
  'noSN',
  'trackSerialNumber',
  'productTypeId',
  'brandId',
  'unitId',
  'codeType',
  'productConfig',
  'warrantyDays',
]
for (const field of allowedProductFields) {
  assert.match(productCreateSource, new RegExp(`\\b${field}\\s*:`), `Missing allowed field ${field}`)
}

// Check forbidden operational fields as complete object keys. This intentionally allows
// the catalog policy field trackSerialNumber while still rejecting a serialNumber payload.
const forbiddenOperationalFields = [
  'costPrice',
  'priceRetail',
  'priceOnline',
  'priceTechnician',
  'priceWholesale',
  'stockItem',
  'stockMovement',
  'serialNumber',
  'supplier',
  'customer',
  'sale',
  'purchaseOrder',
  'taxDocument',
  'repairJob',
  'warrantyClaim',
  'reservation',
  'productImage',
  'branchPrice',
]
for (const field of forbiddenOperationalFields) {
  assert.doesNotMatch(
    productCreateSource,
    new RegExp(`\\b${field}\\s*:`, 'i'),
    `Forbidden operational field: ${field}`
  )
}

// Service-owned input normalization and explicit payload contract.
assert.match(promoteService, /name is required/)
assert.match(promoteService, /mode must be SIMPLE or STRUCTURED/)
assert.match(promoteService, /productTypeId/)
assert.match(promoteService, /decisionNote must not exceed 2000 characters/)
assert.doesNotMatch(promoteService, /costPrice|priceRetail|priceOnline|priceTechnician|priceWholesale/)

// No source Product, price, stock, or media mutations are authorized in either terminal path.
const terminalSources = `${mergeRepository}\n${promoteRepository}`
assert.doesNotMatch(terminalSources, /tx\.(branchPrice|stockItem|stockMovement|productImage)\.(create|update|updateMany|upsert|delete|deleteMany)\s*\(/)
assert.doesNotMatch(terminalSources, /sourceProduct.*(update|delete)/i)

console.log('product-template-candidate-promotion-slice-3.contract.test.js: PASS')
