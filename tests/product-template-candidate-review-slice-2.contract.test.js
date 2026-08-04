const assert = require('assert')
const fs = require('fs')
const path = require('path')

const read = (relativePath) =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')

const routes = read(
  'src/modules/productTemplate/candidates/routes/productTemplateCandidateRoutes.js'
)
const startRepository = read(
  'src/modules/productTemplate/candidates/review/start/startProductTemplateCandidateReviewRepository.js'
)
const startService = read(
  'src/modules/productTemplate/candidates/review/start/startProductTemplateCandidateReviewService.js'
)
const rejectRepository = read(
  'src/modules/productTemplate/candidates/review/reject/rejectProductTemplateCandidateRepository.js'
)
const rejectService = read(
  'src/modules/productTemplate/candidates/review/reject/rejectProductTemplateCandidateService.js'
)

assert.match(routes, /router\.use\(verifyToken\)/)
assert.match(routes, /router\.use\(requireSuperAdmin\)/)
assert.match(
  routes,
  /router\.post\('\/:id\/start-review',\s*startProductTemplateCandidateReview\)/
)
assert.match(
  routes,
  /router\.post\('\/:id\/reject',\s*rejectProductTemplateCandidate\)/
)

assert.match(startRepository, /prisma\.\$transaction\(/)
assert.match(startRepository, /productTemplateCandidate\.updateMany\(/)
assert.match(startRepository, /status:\s*'DRAFT'/)
assert.match(startRepository, /status:\s*'UNDER_REVIEW'/)
assert.match(startRepository, /eventType:\s*'REVIEW_STARTED'/)
assert.match(startRepository, /previousStatus:\s*'DRAFT'/)
assert.match(startRepository, /resultingStatus:\s*'UNDER_REVIEW'/)
assert.match(startRepository, /reviewedByEmployeeId:\s*actorEmployeeId/)
assert.match(startRepository, /reviewedAt/)
assert.match(startService, /CANDIDATE_NOT_FOUND/)
assert.match(startService, /CANDIDATE_REVIEW_TRANSITION_CONFLICT/)

assert.match(rejectRepository, /prisma\.\$transaction\(/)
assert.match(rejectRepository, /productTemplateCandidate\.updateMany\(/)
assert.match(rejectRepository, /status:\s*'UNDER_REVIEW'/)
assert.match(rejectRepository, /status:\s*'REJECTED'/)
assert.match(rejectRepository, /eventType:\s*'REJECTED'/)
assert.match(rejectRepository, /previousStatus:\s*'UNDER_REVIEW'/)
assert.match(rejectRepository, /resultingStatus:\s*'REJECTED'/)
assert.match(rejectRepository, /decisionNote/)
assert.match(rejectRepository, /note:\s*decisionNote/)
assert.match(rejectRepository, /reviewedByEmployeeId:\s*actorEmployeeId/)
assert.match(rejectRepository, /reviewedAt/)

assert.match(rejectService, /CANDIDATE_REJECTION_REASON_REQUIRED/)
assert.match(rejectService, /CANDIDATE_REJECTION_REASON_TOO_LONG/)
assert.match(rejectService, /note\.length\s*>\s*2000/)
assert.match(rejectService, /CANDIDATE_NOT_FOUND/)
assert.match(rejectService, /CANDIDATE_REJECT_TRANSITION_CONFLICT/)
assert.match(rejectService, /assertSuperAdmin\(user\)/)

for (const source of [startRepository, rejectRepository]) {
  assert.doesNotMatch(source, /product\.update/i)
  assert.doesNotMatch(source, /productTemplate\.create/i)
  assert.doesNotMatch(source, /productTemplate\.update/i)
  assert.doesNotMatch(source, /stockItem\.(create|update|delete)/i)
  assert.doesNotMatch(source, /branchPrice\.(create|update|delete)/i)
}

console.log('product-template-candidate-review-slice-2.contract.test.js: PASS')
