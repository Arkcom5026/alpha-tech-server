const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const migration = fs.readFileSync(path.join(__dirname, 'migration.sql'), 'utf8')

assert.match(migration, /CREATE TABLE "QuickReceiptSession"/)
assert.match(migration, /CREATE TABLE "QuickReceiptSessionItem"/)
assert.match(migration, /CREATE TABLE "QuickReceiptFinalizeCommand"/)

assert.match(migration, /CHECK \("status" IN \('DRAFT','FINALIZING','COMPLETED','CANCELLED'\)\)/)
assert.match(migration, /UNIQUE \("branchId", "commandKey"\)/)
assert.match(migration, /"receiptId" INTEGER NOT NULL UNIQUE/)
assert.match(migration, /ON "QuickReceiptSession"\("branchId", "supplierId", "normalizedDeliveryNoteNumber"\)/)
assert.match(migration, /WHERE "status" IN \('DRAFT','FINALIZING','COMPLETED'\)/)

assert.match(migration, /"documentSubtotal" DECIMAL\(12,2\)/)
assert.match(migration, /"documentVatAmount" DECIMAL\(12,2\)/)
assert.match(migration, /"documentTotalAmount" DECIMAL\(12,2\)/)
assert.match(migration, /"items" JSONB NOT NULL DEFAULT '\[\]'::jsonb/)

console.log('✅ Quick Receipt migration authority contract passed')
