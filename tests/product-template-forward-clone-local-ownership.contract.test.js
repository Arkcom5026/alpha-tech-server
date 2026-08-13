'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(
  path.resolve(__dirname, '../src/modules/product/templateClone/services/productTemplateCloneService.js'),
  'utf8'
)

const cloneStart = source.indexOf('const cloneOperationalProductFromTemplate = async')
assert.ok(cloneStart >= 0, 'forward clone service must exist')

const cloneSource = source.slice(cloneStart)
const existingLookupIndex = cloneSource.indexOf('findOperationalRuntimeProductByTemplateId({')
const typeAuthorityIndex = cloneSource.indexOf('const globalProductTypeId = template.productType?.globalProductTypeId')
const adoptTypeIndex = cloneSource.indexOf('await adoptBranchProductType({')

assert.ok(existingLookupIndex >= 0, 'forward clone must resolve an existing traced operational product')
assert.ok(typeAuthorityIndex >= 0, 'new clone path must still validate Template ProductType authority')
assert.ok(adoptTypeIndex >= 0, 'new clone path must still adopt the exact branch ProductType identity')

assert.ok(
  existingLookupIndex < typeAuthorityIndex,
  'existing traced Local Product must resolve before Template taxonomy validation'
)
assert.ok(
  existingLookupIndex < adoptTypeIndex,
  'existing traced Local Product must resolve before ProductType adoption'
)

const existingBlockStart = cloneSource.indexOf('if (existing) {', existingLookupIndex)
const existingBlockEnd = cloneSource.indexOf('\n    const globalProductTypeId', existingBlockStart)
assert.ok(existingBlockStart >= 0 && existingBlockEnd > existingBlockStart)

const existingBlock = cloneSource.slice(existingBlockStart, existingBlockEnd)
assert.match(existingBlock, /toOperationalRuntimeProduct\(existing, brId\)/)
assert.match(existingBlock, /created:\s*false/)
assert.match(existingBlock, /exists:\s*true/)
assert.match(existingBlock, /statusCode:\s*200/)
assert.doesNotMatch(existingBlock, /assertExistingTemplateTraceProductType/)
assert.doesNotMatch(existingBlock, /adoptBranchProductType/)
assert.doesNotMatch(existingBlock, /productType\.update|product\.update/)

console.log('PASS product-template-forward-clone-local-ownership.contract.test.js')
