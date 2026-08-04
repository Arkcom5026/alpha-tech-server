const assert = require('assert')
const fs = require('fs')
const path = require('path')

const repositoryPath = path.join(
  __dirname,
  '..',
  'src',
  'modules',
  'productTemplate',
  'candidates',
  'discovery',
  'auditProductTemplateDiscoveryRepository.js'
)

const source = fs.readFileSync(repositoryPath, 'utf8')

assert.match(source, /businessType,\s*\n\s*address: 'SYSTEM TEMPLATE'/)
assert.match(source, /branchCode: \{ not: null \}/)
assert.doesNotMatch(source, /categoryId:\s*\{\s*not:\s*null\s*\}/)
assert.match(source, /findStoreBranchesByCategory/)
assert.match(source, /categoryId,\s*\n\s*id: \{ not: templateBranchId \}/)

console.log('product-template-discovery-required-category-filter.contract.test.js: PASS')
