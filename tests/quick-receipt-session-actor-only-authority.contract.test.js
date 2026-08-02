'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const servicePath = path.join(
  process.cwd(),
  'src/modules/product/quickStock/services/QuickReceiptSessionService.js'
)

const source = fs.readFileSync(servicePath, 'utf8')

assert.match(
  source,
  /async getReceipt\(receiptId, actor = \{\}, db = this\.prisma\)/,
  'getReceipt must require an actor object instead of accepting a primitive branchId'
)

assert.doesNotMatch(
  source,
  /actorOrBranchId|typeof actorOrBranchId === 'object'/,
  'primitive branchId compatibility must be retired from getReceipt'
)

assert.match(
  source,
  /const authority = priceAuthorityPolicy\.assertActor\(actor\)/,
  'getReceipt must normalize authority through the central policy'
)

assert.doesNotMatch(
  source,
  /this\.getReceipt\([^\n]*,\s*(authority\.branchId|brId),/,
  'transactional reads must preserve the complete actor authority'
)

assert.doesNotMatch(
  source,
  /return this\.getReceipt\([^\n]*,\s*(authority\.branchId|brId)\)/,
  'internal reads must not downgrade authority to a primitive branchId'
)

console.log('quick-receipt-session-actor-only-authority.contract.test.js: PASS')
