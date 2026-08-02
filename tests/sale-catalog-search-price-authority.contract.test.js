'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const target = path.join(
  __dirname,
  '../src/modules/sales/catalog/controllers/saleCatalogSearchController.js',
)
const source = fs.readFileSync(target, 'utf8')

assert(source.includes("require('../../../product/pricing/policies/effectivePricePolicy')"))
assert(source.includes("'ACTIVE_BRANCH_PRICE_NOT_FOUND'"))
assert(source.includes("resolve('retail')"))
assert(source.includes("resolve('wholesale')"))
assert(source.includes("resolve('technician')"))
assert(source.includes("resolve('online')"))
assert(!source.includes('const pricesOf = (branchPrice) => ({'))
assert(!source.includes('retail: toNumber(branchPrice?.priceRetail)'))
assert(source.includes('error?.statusCode || error?.status || 500'))
assert(source.includes("error?.code || 'SALE_CATALOG_SEARCH_FAILED'"))

console.log('sale-catalog-search-price-authority.contract.test.js: PASS')
