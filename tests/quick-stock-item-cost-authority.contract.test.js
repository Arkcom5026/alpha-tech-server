'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '../src/modules/product/quickStock/services/QuickStockService.js')
const source = fs.readFileSync(file, 'utf8')

assert(source.includes("priceAuthorityPolicy.assertPricePayload"), 'QuickStock must use price authority policy')
assert(source.includes("data.items.map((item, index)"), 'QuickStock must preflight every structured item cost')
assert(source.includes("error.detail = { ...(error.detail || {}), index }"), 'item-level price errors must identify the failing index')
assert(source.includes("QUICK_STOCK_MIXED_ITEM_COST_NOT_ALLOWED"), 'mixed item costs must be rejected deterministically')
assert(!source.includes("costPrice: 0"), 'QuickStock must not silently persist zero cost')
assert(source.includes("costPrice: itemCosts[index]"), 'validated item cost must be persisted to each stock item')
assert(source.includes("lastCost = initialCostPrice"), 'stock balance cost must derive from validated authority input')

console.log('quick-stock-item-cost-authority.contract.test.js: PASS')
