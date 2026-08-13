'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'src/modules/product/templateClone/services/productTemplateCloneService.js'),
  'utf8'
)

const start = source.indexOf('const ensureSelectedBrandMapping')
const end = source.indexOf('const resolveCloneSaleBarcode', start)
assert.ok(start >= 0 && end > start, 'ensureSelectedBrandMapping boundary must exist')

const block = source.slice(start, end)
assert.match(block, /productTypeBrand\.upsert\(/)
assert.match(block, /productTypeId_brandId/)
assert.match(block, /update:\s*\{\}/)
assert.doesNotMatch(block, /productTypeBrand\.create\(/)
assert.doesNotMatch(block, /catch\s*\(/)

console.log('Product Template Forward Clone Brand Mapping Transaction Contract: PASS')
