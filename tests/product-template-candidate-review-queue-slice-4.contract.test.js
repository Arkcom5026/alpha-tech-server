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
const routes = read(
  'src/modules/productTemplate/candidates/routes/productTemplateCandidateRoutes.js'
)

// Existing authenticated SUPERADMIN queue endpoint remains the authority.
assert.match(routes, /router\.use\(verifyToken\)/)
assert.match(routes, /router\.use\(requireSuperAdmin\)/)
assert.match(routes, /router\.get\('\/',\s*listProductTemplateCandidates\)/)
assert.match(service, /assertSuperAdmin\(user\)/)

// EmployeeProfile projection must use the real schema field: name.
assert.match(repository, /createdByEmployee:\s*\{\s*select:\s*\{\s*id:\s*true,\s*name:\s*true\s*\}\s*\}/s)
assert.match(repository, /reviewedByEmployee:\s*\{\s*select:\s*\{\s*id:\s*true,\s*name:\s*true\s*\}\s*\}/s)
assert.doesNotMatch(repository, /firstName|lastName/)

// Queue search is catalog/governance-only and covers the intended identities.
assert.match(service, /normalizeSearch\(query\.q \|\| query\.search\)/)
assert.match(service, /sourceProduct:\s*\{\s*name:\s*\{\s*contains:\s*q,\s*mode:\s*'insensitive'/s)
assert.match(service, /sourceBranch:\s*\{\s*name:\s*\{\s*contains:\s*q,\s*mode:\s*'insensitive'/s)
assert.match(service, /sourceBranch:\s*\{\s*branchCode:\s*\{\s*contains:\s*q,\s*mode:\s*'insensitive'/s)
assert.match(service, /targetTemplateProduct:\s*\{\s*name:\s*\{\s*contains:\s*q,\s*mode:\s*'insensitive'/s)
assert.match(service, /targetTemplateBranch:\s*\{\s*branchCode:\s*\{\s*contains:\s*q,\s*mode:\s*'insensitive'/s)
assert.match(service, /Number\.parseInt\(q,\s*10\)/)

// Sorting is allowlisted and never forwards arbitrary client field names.
for (const field of ['createdAt', 'updatedAt', 'reviewedAt', 'promotedAt', 'status']) {
  assert.match(service, new RegExp(`['"]${field}['"]`), `Missing allowed sort field ${field}`)
}
assert.match(service, /ALLOWED_SORT_FIELDS\.has/)
assert.match(service, /sortDirection/)
assert.match(service, /return \[\{ \[sortBy\]: direction \}, \{ id: direction \}\]/)
assert.doesNotMatch(repository, /orderBy:\s*req\.|orderBy:\s*query\./)

// Existing filters and reviewer filter remain validated as positive identifiers.
assert.match(service, /toPositiveInt\(query\.sourceBranchId,\s*'sourceBranchId'\)/)
assert.match(service, /toPositiveInt\(query\.targetTemplateBranchId,\s*'targetTemplateBranchId'\)/)
assert.match(service, /toPositiveInt\(query\.reviewerId,\s*'reviewerId'\)/)
assert.match(service, /reviewedByEmployeeId:\s*reviewerId/)
assert.match(service, /Math\.min\(toPageNumber\(query\.pageSize,\s*30\),\s*100\)/)

// Summary counts and reviewer workload are computed from read-only groupBy projections.
assert.match(repository, /productTemplateCandidate\.groupBy\(/)
assert.match(repository, /by:\s*\['status'\]/)
assert.match(repository, /by:\s*\['reviewedByEmployeeId',\s*'status'\]/)
assert.match(repository, /reviewedByEmployeeId:\s*\{\s*not:\s*null\s*\}/)
assert.match(service, /statusSummary/)
assert.match(service, /assigned:\s*0/)
assert.match(service, /pending:\s*0/)
assert.match(service, /reviewed:\s*0/)
assert.match(service, /group\.status === 'UNDER_REVIEW'/)
assert.match(service, /\['REJECTED',\s*'PROMOTED',\s*'MERGED',\s*'CANCELLED'\]\.includes\(group\.status\)/)
assert.match(service, /reviewerWorkload:/)

// Queue query remains strictly read-only and catalog-safe.
const queueSources = `${repository}\n${service}`
assert.doesNotMatch(
  queueSources,
  /productTemplateCandidate\.(create|update|updateMany|upsert|delete|deleteMany)\s*\(/
)
assert.doesNotMatch(
  queueSources,
  /prisma\.(product|branch|employeeProfile|branchPrice|stockItem|stockMovement|productImage)\.(create|update|updateMany|upsert|delete|deleteMany)\s*\(/
)
assert.doesNotMatch(
  repository,
  /costPrice|priceRetail|priceOnline|priceTechnician|priceWholesale|serialNumber|supplier|customer|sale|purchaseOrder|taxDocument|repairJob|warrantyClaim|reservation/i
)
assert.doesNotMatch(queueSources, /\$queryRaw|\$executeRaw/)

console.log('product-template-candidate-review-queue-slice-4.contract.test.js: PASS')
