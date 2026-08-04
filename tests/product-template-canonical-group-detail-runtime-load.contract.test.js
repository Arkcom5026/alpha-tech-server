const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const servicePath = path.join(
  process.cwd(),
  'src/modules/productTemplate/candidates/query/groups/getCanonicalProductGroupService.js'
)
const serviceSource = fs.readFileSync(servicePath, 'utf8')

const expectedImports = [
  '../../discovery/auditProductTemplateDiscoveryService',
  '../../shared/productTemplateCandidatePolicy',
]

for (const importPath of expectedImports) {
  assert.ok(
    serviceSource.includes(`require('${importPath}')`),
    `Expected service to import ${importPath}`
  )

  const resolvedPath = path.resolve(path.dirname(servicePath), `${importPath}.js`)
  assert.ok(fs.existsSync(resolvedPath), `Expected import target to exist: ${resolvedPath}`)
}

assert.ok(
  !serviceSource.includes("require('../../../discovery/auditProductTemplateDiscoveryService')"),
  'Legacy discovery import must not remain'
)
assert.ok(
  !serviceSource.includes("require('../../../shared/productTemplateCandidatePolicy')"),
  'Legacy shared import must not remain'
)

console.log('product-template-canonical-group-detail-runtime-load.contract.test.js: PASS')
