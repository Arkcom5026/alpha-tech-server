const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const authRoutes = read('src/modules/auth/routes/sessionAuthRoutes.js')
const partnerRoutes = read('src/modules/partnerStore/application/partnerStoreApplicationRoutes.js')
const partnerService = read('src/modules/partnerStore/application/partnerStoreApplicationService.js')
const applicationSchema = read('prisma/partner-store-application.prisma')

assert.ok(partnerRoutes.includes("publicRouter.post('/', controller.submit)"))
assert.ok(applicationSchema.includes('model PartnerStoreApplication'))

const createApplication = partnerService.match(/const createApplication = async[\s\S]*?\n}\n\nconst listApplications/)
assert.ok(createApplication, 'createApplication boundary must be discoverable')
assert.ok(!createApplication[0].includes('tx.branch.create'))
assert.ok(!createApplication[0].includes('tx.partnerStoreCapability.create'))

assert.ok(authRoutes.includes("code: 'AUTH_REGISTER_BOUNDARY_RETIRED'"))
assert.ok(authRoutes.includes("router.post('/register', retiredGenericRegister)"))
assert.ok(!authRoutes.includes("router.post('/register', register)"))
assert.ok(!partnerRoutes.includes("post('/:id/review'"), 'review transition is not authority until v2 state machine is implemented')

console.log('partner store registration authority v2 boundary contract: PASS')
