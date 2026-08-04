const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const routes = read(
  'src/modules/productTemplate/candidates/routes/productTemplateCandidateRoutes.js'
)
const createRepository = read(
  'src/modules/productTemplate/candidates/create/createProductTemplateCandidateRepository.js'
)
const createService = read(
  'src/modules/productTemplate/candidates/create/createProductTemplateCandidateService.js'
)
const listRepository = read(
  'src/modules/productTemplate/candidates/query/list/listProductTemplateCandidatesRepository.js'
)
const detailRepository = read(
  'src/modules/productTemplate/candidates/query/detail/getProductTemplateCandidateRepository.js'
)

assert.match(routes, /router\.use\(verifyToken\)/)
assert.match(routes, /router\.use\(requireSuperAdmin\)/)
assert.match(routes, /router\.get\('\/'/)
assert.match(routes, /router\.post\('\/'/)
assert.match(routes, /router\.get\('\/:id'/)

assert.match(createService, /sourceBranchId/)
assert.match(createService, /SOURCE_PRODUCT_CROSS_BRANCH_CONFLICT/)
assert.match(createService, /SOURCE_PRODUCT_OWNERSHIP_MISSING/)
assert.match(createRepository, /prisma\.\$transaction/)
assert.match(createRepository, /eventType:\s*'CREATED'/)

const projectionSources = [createRepository, listRepository, detailRepository].join('\n')
const forbiddenProjectionTokens = [
  'serialNumber:',
  'costPrice:',
  'priceRetail:',
  'priceWholesale:',
  'priceTechnician:',
  'priceOnline:',
  'stockItems:',
  'sales:',
  'purchaseOrders:',
  'customers:',
  'taxDocuments:',
  'repairJobs:',
  'warrantyClaims:',
  'reservations:',
]

for (const token of forbiddenProjectionTokens) {
  assert.ok(
    !projectionSources.includes(token),
    `Forbidden operational projection token found: ${token}`
  )
}

assert.match(listRepository, /productTemplateCandidate\.findMany/)
assert.match(listRepository, /productTemplateCandidate\.count/)
assert.match(detailRepository, /productTemplateCandidate\.findUnique/)
assert.match(detailRepository, /events:/)
assert.match(detailRepository, /orderBy:\s*\[\{ createdAt: 'asc' \}, \{ id: 'asc' \}\]/)

console.log('product-template-candidate-runtime-slice-1.contract.test.js: PASS')
