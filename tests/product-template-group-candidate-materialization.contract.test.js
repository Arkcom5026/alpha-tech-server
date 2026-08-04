const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const servicePath = path.join(
  process.cwd(),
  'src/modules/productTemplate/candidates/discovery/materializeProductTemplateDiscoveryService.js'
)
const source = fs.readFileSync(servicePath, 'utf8')

assert.ok(source.includes("require('../create/createProductTemplateCandidateService')"))
assert.ok(source.includes('materializeGroupCandidates'))
assert.ok(source.includes("mode: apply ? 'GROUPED_APPLY' : 'GROUPED_DRY_RUN'"))
assert.ok(source.includes('sourceProductId: sourceProduct.id'))
assert.ok(source.includes('sourceBranchId: sourceProduct.branchId'))
assert.ok(source.includes('targetTemplateBranchId: templateBranchId'))
assert.ok(source.includes('isDuplicateCandidateError'))
assert.ok(source.includes('skipped: materialized.skipped'))
assert.ok(!source.includes('GROUPED_CANDIDATE_MATERIALIZATION_NOT_ENABLED'))
assert.ok(!source.includes('prisma.product.update'))
assert.ok(!source.includes('branchPrice'))
assert.ok(!source.includes('stockItem'))

console.log('product-template-group-candidate-materialization.contract.test.js: PASS')
