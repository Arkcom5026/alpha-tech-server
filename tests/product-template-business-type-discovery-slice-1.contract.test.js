const assert = require('assert')
const fs = require('fs')
const path = require('path')

const read = (relativePath) =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')

const repository = read(
  'src/modules/productTemplate/candidates/query/list/listProductTemplateCandidatesRepository.js'
)
const service = read(
  'src/modules/productTemplate/candidates/query/list/listProductTemplateCandidatesService.js'
)

// Business Type authority is derived from the source Branch and not duplicated into Candidate persistence.
assert.match(service, /const \{ BusinessType \} = require\('@prisma\/client'\)/)
assert.match(service, /ALLOWED_BUSINESS_TYPES = new Set\(Object\.values\(BusinessType\)\)/)
assert.match(service, /normalizeBusinessType\(query\.businessType\)/)
assert.match(service, /INVALID_BUSINESS_TYPE/)
assert.match(service, /sourceBranch:\s*\{\s*businessType\s*\}/s)
assert.match(repository, /sourceBranch:\s*\{\s*select:\s*\{[^}]*businessType:\s*true/s)

// The boundary applies to list results, totals, status summary and reviewer workload through summaryWhere.
assert.match(service, /const summaryWhere = \{/)
assert.match(service, /businessType \? \{ sourceBranch: \{ businessType \} \} : \{\}/)
assert.match(service, /where,\s*summaryWhere,/s)
assert.match(service, /filters:\s*\{\s*businessType,/s)
assert.match(repository, /productTemplateCandidate\.count\(\{ where \}\)/)
assert.match(repository, /where:\s*summaryWhere/)
assert.match(repository, /\.\.\.summaryWhere,\s*reviewedByEmployeeId:/s)

// Slice 1 remains read-only and does not duplicate or mutate business/catalog/operational data.
const sources = `${repository}\n${service}`
assert.doesNotMatch(
  sources,
  /productTemplateCandidate\.(create|update|updateMany|upsert|delete|deleteMany)\s*\(/
)
assert.doesNotMatch(
  sources,
  /prisma\.(branch|product|productTemplateCandidate|stockItem|branchPrice)\.(create|update|updateMany|upsert|delete|deleteMany)\s*\(/
)
assert.doesNotMatch(sources, /costPrice|priceRetail|serialNumber|supplier|customer|sale|purchaseOrder/i)
assert.doesNotMatch(sources, /\$queryRaw|\$executeRaw/)

console.log('product-template-business-type-discovery-slice-1.contract.test.js: PASS')
