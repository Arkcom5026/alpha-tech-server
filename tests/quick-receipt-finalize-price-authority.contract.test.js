'use strict'

const assert = require('node:assert/strict')
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

assert.match(
  serviceSource,
  /require\('\.\.\/\.\.\/pricing\/policies\/priceAuthorityPolicy'\)/,
  'Quick Receipt finalization must depend on the central price authority policy',
)
assert.match(
  serviceSource,
  /const baseAuthority = priceAuthorityPolicy\.assertActor\(actor\)/,
  'Quick Receipt finalization must validate authenticated actor context',
)
assert.match(
  serviceSource,
  /priceAuthorityPolicy\.assertPricePayload\(\{ actor: baseAuthority, payload:/,
  'Every receipt line price mutation must pass the central policy',
)
assert.match(
  serviceSource,
  /branchId: brId/,
  'Inventory and price writes must use authority-owned branch identity',
)
assert.match(
  serviceSource,
  /employeeId: empId/,
  'Branch price audit attribution must use authority-owned employee identity',
)
assert.doesNotMatch(
  serviceSource,
  /async finalize\(receiptId, branchId, employeeId, commandKey\)/,
  'Legacy primitive finalize authority signature must not remain active',
)
assert.match(
  controllerSource,
  /role: req\.employee\?\.role \|\| req\.user\?\.role/,
  'Controller must derive role from authenticated context',
)
assert.match(
  controllerSource,
  /v2Role: req\.employee\?\.v2Role \|\| req\.user\?\.v2Role/,
  'Controller must derive v2Role from authenticated context',
)
assert.match(
  controllerSource,
  /service\.finalize\(\s*req\.params\.id,\s*actor,\s*req\.get\('X-Idempotency-Key'\)/s,
  'Controller must pass the authenticated actor object to finalization',
)

console.log('quick-receipt-finalize-price-authority.contract.test.js: PASS')
