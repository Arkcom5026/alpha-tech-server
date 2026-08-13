const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const reviewService = fs.readFileSync(path.join(root, 'src/modules/partnerStore/application/partnerStoreApplicationReviewService.js'), 'utf8')
const controller = fs.readFileSync(path.join(root, 'src/modules/partnerStore/application/partnerStoreApplicationController.js'), 'utf8')
const schema = fs.readFileSync(path.join(root, 'prisma/partner-store-application.prisma'), 'utf8')

assert.ok(reviewService.includes("application.status !== 'PENDING'"))
assert.ok(reviewService.includes("status: 'UNDER_REVIEW'"))
assert.ok(reviewService.includes("eventType: 'REVIEW_STARTED'"))
assert.ok(reviewService.includes('actorUserId: actorId'))
assert.ok(controller.includes('req.user?.id'))
assert.ok(schema.includes('model PartnerStoreApplicationEvent'))
assert.ok(schema.includes('actorUserId'))

console.log('partner store review governance v2 contract: PASS')
