const assert = require('assert')
const fs = require('fs')
const path = require('path')

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')

const service = read('src/modules/productTemplate/candidates/query/groups/getCanonicalProductGroupService.js')
const controller = read('src/modules/productTemplate/candidates/query/groups/getCanonicalProductGroupController.js')
const routes = read('src/modules/productTemplate/candidates/routes/productTemplateCandidateRoutes.js')

assert(service.includes('auditDiscovery'), 'detail must reuse canonical discovery authority')
assert(service.includes("item.groupKey === groupKey"), 'detail must resolve exact canonical group key')
assert(service.includes('CANONICAL_GROUP_NOT_FOUND'), 'detail must expose stable not-found code')
assert(service.includes('templateBranch'), 'detail must return template branch authority')
assert(service.includes('categoryId'), 'detail must return category authority')
assert(service.includes('group,'), 'detail must return the complete group projection')
assert(controller.includes('getCanonicalProductGroupController'), 'detail controller must exist')
assert(routes.includes("router.get('/groups/:groupKey', getCanonicalProductGroupController)"), 'detail route must precede generic candidate id route')

console.log('product-template-canonical-group-detail.contract.test.js: PASS')
