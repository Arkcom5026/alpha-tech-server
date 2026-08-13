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
const codeOnly = block.replace(/\/\/.*$/gm, '')
assert.match(codeOnly, /productTypeBrand\.upsert\(/)
assert.match(codeOnly, /productTypeId_brandId/)
assert.match(codeOnly, /update:\s*\{\}/)
assert.doesNotMatch(codeOnly, /productTypeBrand\.create\(/)
assert.doesNotMatch(codeOnly, /catch\s*\(/)

console.log('Product Template Forward Clone Brand Mapping Transaction Contract: PASS')
