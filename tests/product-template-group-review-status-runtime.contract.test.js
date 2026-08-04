const assert = require('assert')
const fs = require('fs')
const path = require('path')

const servicePath = path.join(
  __dirname,
  '..',
  'src',
  'modules',
  'productTemplate',
  'candidates',
  'query',
  'groups',
  'listCanonicalProductGroupsService.js'
)
const groupingPath = path.join(
  __dirname,
  '..',
  'src',
  'modules',
  'productTemplate',
  'candidates',
  'discovery',
  'groupProductTemplateDiscovery.js'
)

const serviceSource = fs.readFileSync(servicePath, 'utf8')
const groupingSource = fs.readFileSync(groupingPath, 'utf8')

assert.match(
  serviceSource,
  /GROUP_REVIEW_STATUS[\s\S]*require\('\.\.\/\.\.\/discovery\/groupProductTemplateDiscovery'\)/,
  'list service must import GROUP_REVIEW_STATUS from the canonical grouping authority'
)
assert.doesNotMatch(
  serviceSource,
  /GROUP_REVIEW_STATUS[\s\S]*require\('\.\.\/\.\.\/discovery\/auditProductTemplateDiscoveryService'\)/,
  'list service must not import GROUP_REVIEW_STATUS from the audit service'
)
assert.match(
  groupingSource,
  /module\.exports\s*=\s*\{[\s\S]*GROUP_REVIEW_STATUS/,
  'canonical grouping authority must export GROUP_REVIEW_STATUS'
)

console.log('product-template-group-review-status-runtime.contract.test.js: PASS')
