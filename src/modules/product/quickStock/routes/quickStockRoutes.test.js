const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(path.join(__dirname, 'quickStockRoutes.js'), 'utf8')

assert.match(source, /router\.use\(verifyToken, allowQuickStockForEmployeeContext\)/)
assert.match(source, /const allowQuickReceiptAccess = allowQuickReceiptCapabilities\(QUICK_RECEIPT_CAPABILITY\.ACCESS\)/)
assert.match(source, /const allowQuickReceiptFinalize = allowQuickReceiptCapabilities\(\s*QUICK_RECEIPT_CAPABILITY\.ACCESS,\s*QUICK_RECEIPT_CAPABILITY\.FINALIZE,?\s*\)/s)
assert.match(source, /router\.post\('\/receipts\/complete', allowQuickReceiptFinalize, quickReceiptSessionController\.complete\)/)
assert.match(source, /router\.get\('\/receipts', allowQuickReceiptAccess, quickReceiptSessionController\.list\)/)
assert.match(source, /router\.post\('\/receipts', allowQuickReceiptAccess, quickReceiptSessionController\.create\)/)
assert.match(source, /router\.get\('\/receipts\/:id', allowQuickReceiptAccess, quickReceiptSessionController\.detail\)/)
assert.match(source, /router\.patch\('\/receipts\/:id', allowQuickReceiptAccess, quickReceiptSessionController\.update\)/)
assert.match(source, /router\.post\('\/receipts\/:id\/items', allowQuickReceiptAccess, quickReceiptSessionController\.addItem\)/)
assert.match(source, /router\.delete\('\/receipts\/:id\/items\/:itemId', allowQuickReceiptAccess, quickReceiptSessionController\.deleteItem\)/)
assert.match(source, /router\.post\('\/receipts\/:id\/finalize', allowQuickReceiptFinalize, quickReceiptSessionController\.finalize\)/)
assert.match(source, /router\.post\('\/receipts\/:id\/cancel', allowQuickReceiptFinalize, quickReceiptSessionController\.cancel\)/)

const completeIndex = source.indexOf("router.post('/receipts/complete'")
const detailIndex = source.indexOf("router.get('/receipts/:id'")
assert(completeIndex >= 0 && detailIndex >= 0 && completeIndex < detailIndex, 'static /receipts/complete must be declared before dynamic /receipts/:id routes')

console.log('✅ quickStockRoutes quick receipt route contract passed')
