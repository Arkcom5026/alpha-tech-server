'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const servicePath = path.join(
  __dirname,
  '../src/modules/product/quickStock/services/QuickReceiptCompleteService.js'
)
const controllerPath = path.join(
  __dirname,
  '../src/modules/product/quickStock/controllers/quickReceiptSessionController.js'
)

const serviceSource = fs.readFileSync(servicePath, 'utf8')
const controllerSource = fs.readFileSync(controllerPath, 'utf8')

assert.match(
  serviceSource,
  /priceAuthorityPolicy\s*=\s*require\('\.\.\/\.\.\/pricing\/policies\/priceAuthorityPolicy'\)/,
  'QuickReceiptCompleteService must depend on the central price authority policy'
)
assert.match(
  serviceSource,
  /async complete\(payload, actor = \{\}, commandKey\)/,
  'complete must receive an authenticated actor object'
)
assert.match(
  serviceSource,
  /priceAuthorityPolicy\.assertActor\(actor\)/,
  'complete must normalize authenticated authority before reads or writes'
)
assert.match(
  serviceSource,
  /for \(const \[index, line\] of lines\.entries\(\)\)/,
  'complete must validate every receipt line before draft preparation'
)
assert.match(
  serviceSource,
  /priceAuthorityPolicy\.assertPricePayload\(/,
  'every receipt line price payload must pass the central policy'
)
assert.match(
  serviceSource,
  /lineIndex: index/,
  'price failures must identify the failing receipt line'
)
assert.match(
  serviceSource,
  /this\.sessions\.createDraft\(payload, authority\.branchId, authority\.employeeId\)/,
  'draft ownership must come from normalized authority'
)
assert.match(
  serviceSource,
  /this\.sessions\.finalize\(receipt\.id, authority, key\)/,
  'finalization must receive the same normalized authority'
)
assert.doesNotMatch(
  serviceSource,
  /async complete\(payload, branchId, employeeId, commandKey\)/,
  'primitive branch and employee authority signature must remain retired'
)
assert.match(
  controllerSource,
  /completeService\.complete\([\s\S]*req\.body \|\| \{\},[\s\S]*actor,[\s\S]*req\.get\('X-Idempotency-Key'\)/,
  'controller must propagate the full authenticated actor to complete service'
)

console.log('quick receipt complete price authority contract: PASS')
