'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const servicePath = path.join(__dirname, '../src/modules/product/quickStock/services/QuickStockService.js')
const repositoryPath = path.join(__dirname, '../src/modules/product/quickStock/repositories/quickStockRepository.js')
const policyPath = path.join(__dirname, '../src/modules/product/pricing/policies/priceAuthorityPolicy.js')

const service = fs.readFileSync(servicePath, 'utf8')
const repository = fs.readFileSync(repositoryPath, 'utf8')
const policy = fs.readFileSync(policyPath, 'utf8')

assert.match(
  service,
  /priceAuthorityPolicy\.assertPriceValue\('costPrice', receiveCost\)/,
  'existing intake cost must be validated as a receipt value without treating it as a branch-price mutation',
)
assert.match(
  service,
  /const requestedBranchPricePayload = \{\s*priceRetail:[\s\S]*priceWholesale:[\s\S]*priceTechnician:[\s\S]*priceOnline:[\s\S]*\}/,
  'existing intake must isolate sell-price mutation fields from receipt cost',
)
assert.match(
  service,
  /buildChangedBranchPricePayload\([\s\S]*currentPrice: currentBranchPrice,[\s\S]*requestedPayload: requestedBranchPricePayload/,
  'sell-price authority must compare requested values with the current branch price',
)
assert.match(
  service,
  /if \(changedBranchPriceFields\.length > 0\) \{[\s\S]*priceAuthorityPolicy\.assertPricePayload/,
  'price mutation authority must run only when a branch sell price actually changes',
)
assert.match(
  service,
  /data: \{\s*\.\.\.changedBranchPricePayload,\s*updatedBy: authority\.employeeId/,
  'existing branch price updates must persist only changed sell-price fields',
)
assert.match(
  service,
  /costPrice: Number\(receiveCost\)/,
  'receipt cost must remain the StockItem acquisition cost',
)
assert.match(
  service,
  /lastReceivedCost: Number\(receiveCost\)/,
  'receipt cost must remain the stock-balance last received cost',
)
assert.match(
  repository,
  /select: \{\s*id: true,\s*costPrice: true,\s*priceRetail: true,\s*priceWholesale: true,\s*priceTechnician: true,\s*priceOnline: true/,
  'Quick Stock repository must expose the current branch-price snapshot for no-op comparison',
)
assert.match(
  policy,
  /assertPriceValue,\s*assertPricePayload/,
  'price policy must expose value validation separately from mutation authority',
)

console.log('quick-stock-existing-intake-price-semantics.contract.test.js: PASS')
