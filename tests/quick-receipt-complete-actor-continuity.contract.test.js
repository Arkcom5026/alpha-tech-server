'use strict'

const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')

const servicePath = path.join(
  __dirname,
  '../src/modules/product/quickStock/services/QuickReceiptCompleteService.js'
)
const source = fs.readFileSync(servicePath, 'utf8')

assert.match(source, /const authority = priceAuthorityPolicy\.assertActor\(actor\)/)
assert.match(source, /this\.sessions\.getReceipt\(priorCommands\[0\]\.receiptId, authority\)/)
assert.match(source, /this\.sessions\.createDraft\(payload, authority\)/)
assert.match(source, /this\.sessions\.addItem\(receipt\.id, line, authority\)/)
assert.match(source, /this\.sessions\.finalize\(receipt\.id, authority, key\)/)
assert.match(source, /this\.sessions\.getReceipt\(receipt\.id, authority\)/)
assert.match(source, /this\.sessions\.cancel\(\s*receipt\.id,\s*authority,/s)
assert.doesNotMatch(source, /createDraft\(payload, authority\.branchId, authority\.employeeId\)/)
assert.doesNotMatch(source, /addItem\(receipt\.id, line, authority\.branchId\)/)
assert.doesNotMatch(source, /cancel\(\s*receipt\.id,\s*authority\.branchId,/s)

console.log('quick-receipt-complete-actor-continuity.contract.test.js: PASS')
