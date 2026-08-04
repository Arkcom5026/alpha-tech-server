const assert = require('assert')
const fs = require('fs')
const path = require('path')

const repositoryPath = path.join(
  __dirname,
  '../src/modules/productTemplate/candidates/discovery/auditProductTemplateDiscoveryRepository.js'
)
const servicePath = path.join(
  __dirname,
  '../src/modules/productTemplate/candidates/discovery/auditProductTemplateDiscoveryService.js'
)

const repositorySource = fs.readFileSync(repositoryPath, 'utf8')
const serviceSource = fs.readFileSync(servicePath, 'utf8')

assert.match(
  repositorySource,
  /productType:\s*\{[\s\S]*branchId:\s*\{\s*in:\s*branchIds\s*\}/,
  'Store Product discovery must scope ownership through ProductType.branchId'
)

assert.match(
  repositorySource,
  /productType:\s*\{[\s\S]*branchId:\s*templateBranchId/,
  'Template Product discovery must scope ownership through ProductType.branchId'
)

assert.match(
  repositorySource,
  /productType:[\s\S]*branchId:\s*true[\s\S]*branch:\s*\{/,
  'Discovery select must include the ProductType ownership Branch'
)

assert.doesNotMatch(
  repositorySource,
  /where:\s*\{\s*branchId:\s*\{\s*in:\s*branchIds/,
  'Discovery must not use Product.branchId as the store ownership authority'
)

assert.match(
  serviceSource,
  /resolveProductOwnershipBranch\s*=\s*\(product\)\s*=>\s*product\?\.productType\?\.branch/,
  'Discovery evidence must resolve branch identity through ProductType.branch'
)

assert.match(
  serviceSource,
  /branchId:\s*ownershipBranch\?\.id\s*\|\|\s*product\.productType\?\.branchId/,
  'Source Product evidence must report the ProductType ownership branch id'
)

console.log('product-template-discovery-product-type-ownership-fix.contract.test.js: PASS')
