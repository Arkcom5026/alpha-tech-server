'use strict'

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const repository = read('src/modules/partnerStore/onlineVisibility/onlineProductVisibilityRepository.js')
const service = read('src/modules/partnerStore/onlineVisibility/onlineProductVisibilityService.js')
const controller = read('src/modules/partnerStore/onlineVisibility/onlineProductVisibilityController.js')
const routes = read('src/modules/partnerStore/routes/partnerStoreCapabilityRoutes.js')

const assertIncludes = (source, value, label) => {
  if (!source.includes(value)) throw new Error(`${label} missing: ${value}`)
}

assertIncludes(repository, 'WHERE price."branchId" = ${branchId}', 'branch isolation authority')
assertIncludes(repository, 'price."priceOnline"', 'online price audit')
assertIncludes(repository, 'price."effectiveDate"', 'effective date audit')
assertIncludes(repository, 'price."expiredDate"', 'expiry audit')
assertIncludes(repository, 'GREATEST(COALESCE(balance."quantity", 0) - COALESCE(balance."reserved", 0), 0)', 'available stock audit')

for (const reason of [
  'PRODUCT_INACTIVE',
  'PRICE_INACTIVE',
  'MISSING_ONLINE_PRICE',
  'PRICE_NOT_STARTED',
  'PRICE_EXPIRED',
  'BRAND_INACTIVE',
  'TAXONOMY_INACTIVE',
  'OUT_OF_STOCK',
]) {
  assertIncludes(service, reason, 'visibility reason contract')
}

assertIncludes(service, "reason !== REASONS.OUT_OF_STOCK", 'public visibility parity')
assertIncludes(service, "status: visibleOnline", 'audit status projection')
assertIncludes(controller, 'req.employee?.branchId || req.user?.branchId', 'authenticated branch authority')
assertIncludes(routes, "router.get('/online-products/visibility-audit'", 'merchant audit route')

console.log('online product visibility audit contract: PASS')
