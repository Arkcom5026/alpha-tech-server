const assert = require('assert')
const fs = require('fs')
const path = require('path')

const read = (relativePath) =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')

const grouping = read(
  'src/modules/productTemplate/candidates/discovery/groupProductTemplateDiscovery.js'
)
const audit = read(
  'src/modules/productTemplate/candidates/discovery/auditProductTemplateDiscoveryService.js'
)
const materialize = read(
  'src/modules/productTemplate/candidates/discovery/materializeProductTemplateDiscoveryService.js'
)

assert.match(grouping, /buildCandidateGroupKey/)
assert.match(grouping, /canonicalBrandName/)
assert.match(grouping, /sourceBranchCount/)
assert.match(grouping, /PRODUCT_TYPE_REVIEW_REQUIRED/)
assert.match(grouping, /CONFLICTING_GLOBAL_PRODUCT_TYPE/)
assert.match(grouping, /MISSING_GLOBAL_PRODUCT_TYPE/)
assert.match(audit, /groupUnmatchedDiscoveryItems\(unmatchedItems\)/)
assert.match(audit, /groupSummary/)
assert.match(audit, /groups,/)
assert.match(materialize, /GROUPED_DRY_RUN/)
assert.match(materialize, /GROUPED_CANDIDATE_MATERIALIZATION_NOT_ENABLED/)
assert.doesNotMatch(materialize, /createCandidate\(/)

console.log('product-template-candidate-grouping-authority.contract.test.js: PASS')
