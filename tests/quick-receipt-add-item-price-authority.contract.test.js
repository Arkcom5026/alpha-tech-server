'use strict'

const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const servicePath = path.join(
  __dirname,
  '..',
  'src',
  'modules',
  'product',
  'quickStock',
  'services',
  'QuickReceiptSessionService.js',
)
const controllerPath = path.join(
  __dirname,
  '..',
  'src',
  'modules',
  'product',
  'quickStock',
  'controllers',
  'quickReceiptSessionController.js',
)

const serviceSource = fs.readFileSync(servicePath, 'utf8')
const controllerSource = fs.readFileSync(controllerPath, 'utf8')

assert.match(serviceSource, /async addItem\(receiptId, payload, actor = \{\}\)/)
assert.match(serviceSource, /priceAuthorityPolicy\.assertPricePayload\(\{/)
assert.match(serviceSource, /const receipt = await this\.getReceipt\(receiptId, authority\)/)
assert.match(serviceSource, /WHERE "id"=\$1 AND "branchId"=\$2/)
assert.doesNotMatch(serviceSource, /async addItem\(receiptId, payload, branchId\)/)
assert.doesNotMatch(serviceSource, /this\.getReceipt\(receiptId, authority\.branchId\)/)

assert.match(controllerSource, /service\.addItem\(req\.params\.id, req\.body \|\| \{\}, actor\)/)
assert.doesNotMatch(controllerSource, /service\.addItem\(req\.params\.id, req\.body \|\| \{\}, actor\.branchId\)/)

console.log('quick receipt add-item price authority contract: PASS')
