'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'src/modules/product/templateReverseClone/services/storeProductTemplateReverseCloneService.js'),
  'utf8',
)

const start = source.indexOf('const ensureTemplateProductType = async')
const end = source.indexOf('const ensureTemplateProductTypeBrand', start)
assert.ok(start >= 0 && end > start, 'ensureTemplateProductType boundary must exist')

const block = source.slice(start, end)
const codeOnly = block
  .split('\n')
  .map((line) => line.replace(/\/\/.*$/, ''))
  .join('\n')

assert.match(codeOnly, /productType\.upsert\(/)
assert.match(codeOnly, /branchId_globalProductTypeId_normalizedName/)
assert.doesNotMatch(codeOnly, /productType\.create\(/)
assert.doesNotMatch(codeOnly, /catch\s*\(/)

console.log('Store Product Template Reverse Clone Transaction Health Contract: PASS')
