'use strict'

const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const servicePath = path.join(__dirname, '../src/modules/product/quickStock/services/QuickReceiptSessionService.js')
const controllerPath = path.join(__dirname, '../src/modules/product/quickStock/controllers/quickReceiptSessionController.js')
const serviceSource = fs.readFileSync(servicePath, 'utf8')
const controllerSource = fs.readFileSync(controllerPath, 'utf8')

test('quick receipt draft creation requires centralized authenticated actor authority', () => {
  assert.match(serviceSource, /async createDraft\(payload, actor = \{\}\)/)
  assert.match(serviceSource, /priceAuthorityPolicy\.assertActor\(actor\)/)
  assert.match(serviceSource, /authority\.branchId/)
  assert.match(serviceSource, /authority\.employeeId/)
  assert.doesNotMatch(serviceSource, /async createDraft\(payload, branchId, employeeId\)/)
})

test('quick receipt draft update is branch-scoped by normalized authority', () => {
  assert.match(serviceSource, /async updateDraft\(receiptId, payload, actor = \{\}\)/)
  assert.match(serviceSource, /getReceipt\(receiptId, authority\.branchId\)/)
  assert.match(serviceSource, /toInt\(receiptId\), authority\.branchId/)
  assert.doesNotMatch(serviceSource, /async updateDraft\(receiptId, payload, branchId\)/)
})

test('quick receipt line deletion requires actor and branch-owned SQL guard', () => {
  assert.match(serviceSource, /async deleteItem\(receiptId, itemId, actor = \{\}\)/)
  assert.match(serviceSource, /priceAuthorityPolicy\.assertActor\(actor\)/)
  assert.match(serviceSource, /USING "QuickReceiptSession" r/)
  assert.match(serviceSource, /r\."branchId"=\$3/)
  assert.doesNotMatch(serviceSource, /async deleteItem\(receiptId, itemId, branchId\)/)
})

test('controller propagates the complete authenticated actor to all draft mutations', () => {
  assert.match(controllerSource, /service\.createDraft\(req\.body \|\| \{\}, actor\)/)
  assert.match(controllerSource, /service\.updateDraft\(req\.params\.id, req\.body \|\| \{\}, actor\)/)
  assert.match(controllerSource, /service\.deleteItem\(req\.params\.id, req\.params\.itemId, actor\)/)
  assert.doesNotMatch(controllerSource, /service\.createDraft\(req\.body \|\| \{\}, actor\.branchId, actor\.employeeId\)/)
})
