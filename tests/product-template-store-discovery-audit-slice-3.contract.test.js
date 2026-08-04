const assert = require('assert')
const fs = require('fs')
const path = require('path')

const read = (relativePath) =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')

const repository = read(
  'src/modules/productTemplate/candidates/discovery/auditProductTemplateDiscoveryRepository.js'
)
const service = read(
  'src/modules/productTemplate/candidates/discovery/auditProductTemplateDiscoveryService.js'
)
const controller = read(
  'src/modules/productTemplate/candidates/discovery/auditProductTemplateDiscoveryController.js'
)
const routes = read(
  'src/modules/productTemplate/candidates/routes/productTemplateCandidateRoutes.js'
)

assert.match(routes, /router\.get\('\/discovery-audit',\s*auditProductTemplateDiscovery\)/)
assert.ok(
  routes.indexOf("router.get('/discovery-audit'") < routes.indexOf("router.get('/:id'"),
  'Static discovery route must be registered before the dynamic candidate id route'
)
assert.match(service, /assertSuperAdmin\(user\)/)
assert.match(service, /Object\.values\(BusinessType\)\.includes\(businessType\)/)

// Branch is the Catalog boundary: store branches and SYSTEM TEMPLATE branches are compared by scope.
assert.match(repository, /prisma\.branch\.findMany\(/)
assert.match(repository, /businessType/)
assert.match(repository, /address:\s*'SYSTEM TEMPLATE'/)
assert.match(repository, /branchCode:\s*\{\s*not:\s*null\s*\}/)
assert.match(repository, /categoryId:\s*\{\s*in:\s*categoryIds\s*\}/)

// Product remains the single model for both store products and platform templates.
assert.match(repository, /prisma\.product\.findMany\(/)
assert.match(repository, /templateProductId:\s*true/)
assert.match(repository, /globalProductTypeId:\s*true/)
assert.match(service, /LINKED_TEMPLATE/)
assert.match(service, /MATCHED_UNLINKED/)
assert.match(service, /CANDIDATE_OPEN/)
assert.match(service, /UNMATCHED/)
assert.match(service, /buildCatalogFingerprint/)
assert.match(service, /globalProductTypeId/)
assert.match(service, /normalizedName/)

// Existing open candidates suppress duplicate discovery work.
assert.match(repository, /productTemplateCandidate\.findMany\(/)
assert.match(repository, /status:\s*\{\s*in:\s*\['DRAFT',\s*'UNDER_REVIEW'\]\s*\}/)
assert.match(service, /openCandidateByProductId/)

// Audit is read-only and excludes operational fields.
const sources = `${repository}\n${service}\n${controller}`
assert.doesNotMatch(
  sources,
  /\.(create|update|updateMany|upsert|delete|deleteMany)\s*\(/
)
assert.doesNotMatch(sources, /\$queryRaw|\$executeRaw/)
assert.doesNotMatch(
  repository,
  /costPrice|priceRetail|priceOnline|priceTechnician|priceWholesale|serialNumber|supplier|sale|purchaseOrder|taxDocument|repairJob|warrantyClaim|reservation/i
)

console.log('product-template-store-discovery-audit-slice-3.contract.test.js: PASS')
