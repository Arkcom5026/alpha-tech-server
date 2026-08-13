const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const candidateSchema = read('prisma/platform/product-template.prisma')
const catalogSchema = read('prisma/commerce/catalog.prisma')

assert.match(candidateSchema, /enum ProductTemplateCandidateType\s*{[\s\S]*POSSIBLE_DUPLICATE[\s\S]*QUALITY_REVIEW[\s\S]*ORPHAN_UNUSED[\s\S]*}/)

for (const status of ['OPEN', 'RESOLVED', 'DISMISSED', 'ARCHIVED']) {
  assert.match(candidateSchema, new RegExp(`enum ProductTemplateCandidateStatus\\s*{[\\s\\S]*${status}`))
}

assert.match(candidateSchema, /type\s+ProductTemplateCandidateType\?/)
assert.match(candidateSchema, /templateBranchId\s+Int\?/)
assert.match(candidateSchema, /primaryTemplateProductId\s+Int\?/)
assert.match(candidateSchema, /comparisonTemplateProductId\s+Int\?/)
assert.match(candidateSchema, /dedupeKey\s+String\?\s+@unique/)
assert.match(candidateSchema, /assessment\s+Json\?/)
assert.match(candidateSchema, /resolution\s+Json\?/)
assert.match(candidateSchema, /resolvedAt\s+DateTime\?/)

for (const legacyField of ['sourceBranchId', 'sourceProductId', 'targetTemplateBranchId']) {
  assert.match(candidateSchema, new RegExp(`${legacyField}\\s+Int\\?`))
}

assert.match(candidateSchema, /@@index\(\[templateBranchId, type, status\]\)/)
assert.match(candidateSchema, /@@index\(\[primaryTemplateProductId\]\)/)
assert.match(candidateSchema, /@@index\(\[comparisonTemplateProductId\]\)/)
assert.match(candidateSchema, /@@index\(\[type, status, createdAt\]\)/)

// New catalog-quality references are scalar transition authority first; legacy relations remain intact.
assert.match(candidateSchema, /sourceProduct\s+Product\?\s+@relation\("ProductTemplateCandidateSourceProduct"/)
assert.match(candidateSchema, /targetTemplateProduct\s+Product\?\s+@relation\("ProductTemplateCandidateTargetProduct"/)

// Product remains the operational/template product authority; no duplicate reference counter is introduced.
assert.match(catalogSchema, /templateProductId\s+Int\?/)
assert.match(catalogSchema, /clonedProducts\s+Product\[\]/)
assert.ok(!catalogSchema.includes('templateReferenceCount'))

console.log('product-template-catalog-quality-candidate-schema.contract.test.js: PASS')
