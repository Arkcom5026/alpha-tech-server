'use strict'

const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')

const servicePath = path.join(__dirname, '../src/modules/product/quickStock/services/QuickReceiptSessionService.js')
const controllerPath = path.join(__dirname, '../src/modules/product/quickStock/controllers/quickReceiptSessionController.js')

const service = fs.readFileSync(servicePath, 'utf8')
const controller = fs.readFileSync(controllerPath, 'utf8')

assert.match(service, /async getReceipt\(receiptId, actorOrBranchId/)
assert.match(service, /priceAuthorityPolicy\.assertActor\(actorOrBranchId\)/)
assert.match(service, /JOIN "QuickReceiptSession" r ON r\."id" = i\."receiptId"/)
assert.match(service, /WHERE i\."receiptId" = \$1 AND r\."branchId" = \$2/)
assert.match(service, /async listReceipts\(\{ actor = \{\}/)
assert.match(service, /const authority = priceAuthorityPolicy\.assertActor\(actor\)/)
assert.match(service, /authority\.branchId/)

assert.match(controller, /service\.listReceipts\(\{ actor, \.\.\.req\.query \}\)/)
assert.match(controller, /service\.getReceipt\(req\.params\.id, actor\)/)
assert.match(controller, /PRICE_ACTOR_CONTEXT_REQUIRED/)
assert.match(controller, /actor\.role \|\| actor\.v2Role/)

console.log('quick receipt read authority contract: PASS')
