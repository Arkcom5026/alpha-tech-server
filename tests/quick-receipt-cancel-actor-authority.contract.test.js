'use strict'

const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')

const root = path.resolve(__dirname, '..')
const servicePath = path.join(root, 'src/modules/product/quickStock/services/QuickReceiptSessionService.js')
const controllerPath = path.join(root, 'src/modules/product/quickStock/controllers/quickReceiptSessionController.js')

const service = fs.readFileSync(servicePath, 'utf8')
const controller = fs.readFileSync(controllerPath, 'utf8')

assert.match(service, /async cancel\(receiptId, actor = \{\}, reason\)/)
assert.match(service, /const authority = priceAuthorityPolicy\.assertActor\(actor\)/)
assert.match(service, /this\.getReceipt\(receiptId, authority\)/)
assert.doesNotMatch(service, /this\.getReceipt\(receiptId, authority\.branchId\)/)
assert.match(service, /WHERE \"id\"=\$2 AND \"branchId\"=\$3/)
assert.match(service, /toInt\(receiptId\),\s*authority\.branchId/)
assert.doesNotMatch(service, /async cancel\(receiptId, branchId, reason\)/)

assert.match(controller, /service\.cancel\(req\.params\.id, actor, req\.body\?\.reason\)/)
assert.doesNotMatch(controller, /service\.cancel\(req\.params\.id, actor\.branchId/)

console.log('quick-receipt-cancel-actor-authority.contract.test.js PASS')
