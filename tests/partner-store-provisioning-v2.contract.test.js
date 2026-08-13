const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const schema = read('prisma/partner-store-application.prisma')
const routes = read('src/modules/partnerStore/application/partnerStoreApplicationRoutes.js')

assert.ok(schema.includes('enum PartnerStoreProvisioningStatus'))
assert.ok(schema.includes('PROVISIONING_STARTED'))
assert.ok(schema.includes('STORE_PROVISIONED'))
assert.ok(schema.includes('PROVISIONING_FAILED'))
assert.ok(schema.includes('provisioningStatus'))
assert.ok(!routes.includes("post('/:id/activate'"))

console.log('partner store provisioning v2 contract: PASS')
