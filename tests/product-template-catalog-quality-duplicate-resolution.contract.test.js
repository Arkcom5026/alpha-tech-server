const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const schema = read('prisma/platform/product-template.prisma')
const mergeService = read('src/modules/productTemplate/candidates/promotion/merge/mergeProductTemplateCandidateService.js')
const mergeRepository = read('src/modules/productTemplate/candidates/promotion/merge/mergeProductTemplateCandidateRepository.js')

assert.match(schema, /DUPLICATE_RESOLVED/)
assert.match(schema, /RESOLVED/)
assert.match(schema, /resolution\s+Json\?/)
assert.match(schema, /resolvedAt\s+DateTime\?/)
assert.match(mergeService, /mergeCandidate/)
assert.match(mergeRepository, /prisma\.\$transaction/)

console.log('product-template-catalog-quality-duplicate-resolution.contract.test.js: PASS')
