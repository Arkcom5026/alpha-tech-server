const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const foundation = read('prisma/migrations/20260730030000_partner_store_application_foundation/migration.sql')
const intake = read('src/modules/partnerStore/application/partnerStoreApplicationIntakeService.js')
const publicController = read('src/modules/partnerStore/application/partnerStoreApplicationPublicController.js')
const routes = read('src/modules/partnerStore/application/partnerStoreApplicationRoutes.js')

assert.ok(foundation.includes('An application never creates a Branch or operating identity.'))
assert.ok(intake.includes('submitApplication'))
assert.ok(intake.includes('PARTNER_STORE_APPLICATION_ALREADY_ACTIVE'))
assert.ok(intake.includes('PARTNER_STORE_SLUG_ALREADY_EXISTS'))
assert.ok(!intake.includes('provisionedOwnerUserId'))
assert.ok(publicController.includes("require('./partnerStoreApplicationIntakeService')"))
assert.ok(publicController.includes('intakeService.submitApplication'))
assert.ok(routes.includes("require('./partnerStoreApplicationPublicController')"))
assert.ok(routes.includes("publicRouter.post('/', publicController.submit)"))

console.log('partner store application intake authority v2 contract: PASS')
