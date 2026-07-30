const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const routes = read('src/modules/partnerStore/application/partnerStoreApplicationRoutes.js')
const service = read('src/modules/partnerStore/application/partnerStoreApplicationService.js')
const server = read('server.js')
const schema = read('prisma/partner-store-application.prisma')
const migration = read('prisma/migrations/20260730043000_partner_store_application_provisioning/migration.sql')
const runtimeVerifier = read('scripts/verify-partner-store-application-runtime.js')

assert.ok(routes.includes("publicRouter.post('/', controller.submit)"))
assert.ok(routes.includes('adminRouter.use(verifyToken, requireAdmin.superadmin)'))
assert.ok(routes.includes("adminRouter.post('/:id/approve', controller.approve)"))
assert.ok(routes.includes("adminRouter.post('/:id/reject', controller.reject)"))
assert.ok(server.includes("'/api/public/partner-store-applications'"))
assert.ok(server.includes("'/api/partner-store/applications'"))

for (const token of ['provisionedBranchId', 'provisionedOwnerUserId', 'decidedAt']) {
  assert.ok(schema.includes(token), `application schema must retain ${token}`)
  assert.ok(migration.includes(`"${token}"`), `migration must add ${token}`)
}
assert.ok(service.includes("v2Role: 'OWNER'"))
assert.ok(service.includes("storefrontEnabled: false"))
assert.ok(service.includes("connectOrCreate"))
assert.ok(service.includes("System Partner Store"))
assert.ok(!service.includes('branchPrice.findMany'))
assert.ok(!service.includes('branchPrice.createMany'))
assert.ok(
  !/^\s*(DROP\s+(TABLE|TYPE|INDEX)|TRUNCATE\s+TABLE|INSERT\s+INTO|UPDATE\s+"|DELETE\s+FROM)/im.test(migration),
  'migration must not contain destructive DDL or business-data mutations'
)
assert.ok(!migration.includes('ALTER TABLE "Branch"'))
assert.ok(runtimeVerifier.includes("ALLOW_PARTNER_STORE_RUNTIME_TEST !== 'true'"))
assert.ok(runtimeVerifier.includes('system-test-partner-'))
assert.ok(runtimeVerifier.includes('retainedTestData: true'))
assert.ok(runtimeVerifier.includes('businessData'))
assert.ok(!runtimeVerifier.includes('customerProfile.count'))

console.log('partner store application provisioning contract: PASS')
