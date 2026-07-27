const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(path.join(__dirname, 'QuickReceiptSessionService.js'), 'utf8')

assert.match(source, /return this\.prisma\.\$transaction\(async \(tx\) =>/)
assert.match(source, /FOR UPDATE/)
assert.match(source, /QuickReceiptFinalizeCommand/)
assert.match(source, /IDEMPOTENCY_KEY_REQUIRED/)

assert.match(source, /assertProductCanReceive\(product\)/)
assert.match(source, /BARCODE_QUANTITY_MISMATCH/)
assert.match(source, /DUPLICATE_BARCODE_IN_RECEIPT/)
assert.match(source, /BARCODE_ALREADY_EXISTS/)
assert.match(source, /DUPLICATE_SERIAL_IN_RECEIPT/)
assert.match(source, /SERIAL_ALREADY_EXISTS/)

assert.match(source, /policy\.mode === 'STRUCTURED'/)
assert.match(source, /createStockItems/)
assert.match(source, /createSimpleLot/)
assert.match(source, /createStockMovement/)
assert.match(source, /upsertStockBalance/)
assert.match(source, /refType: 'QUICK_RECEIPT'/)
assert.match(source, /"status"='COMPLETED'/)

const transactionStart = source.indexOf('return this.prisma.$transaction')
const completedUpdate = source.indexOf(`"status"='COMPLETED'`, transactionStart)
const stockMutation = source.indexOf('createStockMovement', transactionStart)
assert.ok(transactionStart >= 0)
assert.ok(stockMutation > transactionStart)
assert.ok(completedUpdate > stockMutation)

console.log('✅ Quick Receipt inventory finalization authority passed')
