const assert = require('assert')
const fs = require('fs')
const path = require('path')

const read = (relativePath) =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')

const repository = read(
  'src/modules/productTemplate/candidates/discovery/auditProductTemplateDiscoveryRepository.js'
)
const service = read(
  'src/modules/productTemplate/candidates/discovery/auditProductTemplateDiscoveryService.js'
)

// UI businessType resolves the SYSTEM TEMPLATE Branch first.
assert.match(repository, /findTemplateBranchByBusinessType/)
assert.match(repository, /businessType/)
assert.match(repository, /address:\s*'SYSTEM TEMPLATE'/)
assert.match(repository, /branchCode:\s*\{\s*not:\s*null\s*\}/)
assert.match(repository, /categoryId:\s*\{\s*not:\s*null\s*\}/)
assert.match(service, /findTemplateBranchByBusinessType\(\{ businessType \}\)/)

// The resolved Template Branch categoryId is the real Store catalog boundary.
assert.match(repository, /findStoreBranchesByCategory/)
assert.match(repository, /categoryId,/)
assert.match(repository, /id:\s*\{\s*not:\s*templateBranchId\s*\}/)
assert.match(repository, /notIn:\s*\['SYSTEM TEMPLATE',\s*'SYSTEM TEST ONLY'\]/)
assert.match(service, /categoryId:\s*templateBranch\.categoryId/)
assert.match(service, /templateBranchId:\s*templateBranch\.id/)

// Template Products come from exactly the resolved Template Branch.
assert.match(repository, /findTemplateProducts/)
assert.match(repository, /branchId:\s*templateBranchId/)
assert.doesNotMatch(service, /categoryIds/)
assert.doesNotMatch(repository, /findStoreBranches\s*=\s*\(\{ businessType \}\)/)

// Discovery must remain environment-safe and must never hard-code Branch 1.
assert.doesNotMatch(`${repository}\n${service}`, /branchId:\s*1\b|templateBranchId:\s*1\b/)

// Read-only safety remains intact.
assert.doesNotMatch(
  `${repository}\n${service}`,
  /\.(create|update|updateMany|upsert|delete|deleteMany)\s*\(/
)
assert.doesNotMatch(`${repository}\n${service}`, /\$queryRaw|\$executeRaw/)

console.log('product-template-category-authority-discovery-fix.contract.test.js: PASS')
