const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const authRoutes = read('src/modules/auth/routes/sessionAuthRoutes.js')
const partnerRoutes = read('src/modules/partnerStore/application/partnerStoreApplicationRoutes.js')
const publicController = read('src/modules/partnerStore/application/partnerStoreApplicationPublicController.js')
const intakeService = read('src/modules/partnerStore/application/partnerStoreApplicationIntakeService.js')
const applicationSchema = read('prisma/partner-store-application.prisma')

assert.ok(partnerRoutes.includes("publicRouter.post('/', publicController.submit)"))
assert.ok(publicController.includes("require('./partnerStoreApplicationIntakeService')"))
assert.ok(publicController.includes('intakeService.submitApplication'))
assert.ok(applicationSchema.includes('model PartnerStoreApplication'))
assert.ok(applicationSchema.includes('model PartnerStoreApplicationEvent'))

assert.ok(intakeService.includes('submitApplication'))
assert.ok(!intakeService.includes('tx.branch.create'))
assert.ok(!intakeService.includes('tx.partnerStoreCapability.create'))
assert.ok(!intakeService.includes('tx.user.create'))

assert.ok(authRoutes.includes("code: 'AUTH_REGISTER_BOUNDARY_RETIRED'"))
assert.ok(authRoutes.includes("router.post('/register', retiredGenericRegister)"))
assert.ok(!authRoutes.includes("router.post('/register', register)"))

assert.ok(partnerRoutes.includes("adminRouter.post('/:id/review', adminController.startReview)"))
assert.ok(partnerRoutes.includes("adminRouter.post('/:id/approve', adminController.approve)"))
assert.ok(partnerRoutes.includes("adminRouter.post('/:id/reject', adminController.reject)"))

console.log('partner store registration authority v2 boundary contract: PASS')
