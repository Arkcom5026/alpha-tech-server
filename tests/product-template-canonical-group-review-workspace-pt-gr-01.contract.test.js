const fs = require('fs')
const path = require('path')

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')

const routes = read('src/modules/productTemplate/candidates/routes/productTemplateCandidateRoutes.js')
const service = read('src/modules/productTemplate/candidates/query/groups/listCanonicalProductGroupsService.js')
const controller = read('src/modules/productTemplate/candidates/query/groups/listCanonicalProductGroupsController.js')

const required = [
  [routes, "router.get('/groups', listCanonicalProductGroupsController)"],
  [service, 'auditDiscovery'],
  [service, 'GROUP_REVIEW_STATUS'],
  [service, 'reviewStatus'],
  [service, 'pagination'],
  [service, 'sourceBranchCount'],
  [service, 'sourceProductCount'],
  [controller, "code: error.code || 'CANONICAL_PRODUCT_GROUP_LIST_FAILED'"],
]

for (const [source, token] of required) {
  if (!source.includes(token)) {
    throw new Error(`Missing canonical group review contract token: ${token}`)
  }
}

if (service.includes('createCandidate(') || service.includes('prisma.')) {
  throw new Error('Canonical group review list must remain a read-only projection')
}

console.log('product-template-canonical-group-review-workspace-pt-gr-01.contract.test.js: PASS')
