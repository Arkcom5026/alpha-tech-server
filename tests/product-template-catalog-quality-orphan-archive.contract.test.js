const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8')

const repository = read(
  'src/modules/productTemplate/candidates/quality/archiveCatalogOrphanCandidateRepository.js'
)

const service = read(
  'src/modules/productTemplate/candidates/quality/archiveCatalogOrphanCandidateService.js'
)

const controller = read(
  'src/modules/productTemplate/candidates/quality/archiveCatalogOrphanCandidateController.js'
)

const routes = read(
  'src/modules/productTemplate/candidates/routes/productTemplateCandidateRoutes.js'
)

const schema = read(
  'prisma/platform/product-template.prisma'
)

assert.match(repository, /pg_advisory_xact_lock/)
assert.match(repository, /clonedProducts/)
assert.match(repository, /templateProductId/)
assert.match(repository, /active:\s*false/)
assert.match(repository, /status:\s*'ARCHIVED'/)
assert.match(repository, /eventType:\s*'ORPHAN_ARCHIVED'/)

assert.match(service, /ORPHAN_PRODUCT_STILL_REFERENCED/)
assert.match(service, /ALREADY_ARCHIVED/)
assert.match(service, /archiveCatalogOrphanCandidateTransaction/)

assert.match(
  controller,
  /archiveCatalogOrphanCandidate/
)

assert.match(
  routes,
  /\/:id\/archive-orphan/
)

assert.match(schema, /ORPHAN_ARCHIVED/)

assert.ok(!repository.includes('saleItem'))
assert.ok(!repository.includes('stockMovement'))
assert.ok(!repository.includes('purchaseOrderItem'))

console.log(
  'product-template-catalog-quality-orphan-archive.contract.test.js: PASS'
)
