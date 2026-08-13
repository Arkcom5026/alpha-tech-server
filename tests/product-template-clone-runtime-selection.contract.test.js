'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(
  path.resolve(__dirname, '../src/modules/product/runtime/repositories/operationalProductRuntimeRepository.js'),
  'utf8'
)

const cloneRepositoryStart = source.indexOf('const findTemplateProductForClone =')
const nextRepositoryStart = source.indexOf('const findBranchProductTypeByGlobalProductTypeId', cloneRepositoryStart)

assert.ok(cloneRepositoryStart >= 0, 'findTemplateProductForClone must exist')
assert.ok(nextRepositoryStart > cloneRepositoryStart, 'clone repository boundary must be discoverable')

const cloneRepositorySource = source.slice(cloneRepositoryStart, nextRepositoryStart)

assert.match(cloneRepositorySource, /productType:\s*\{\s*select:\s*\{[\s\S]*id:\s*true/)
assert.match(cloneRepositorySource, /globalProductTypeId:\s*true/)

console.log('Product Template Clone Runtime Selection Contract: PASS')
