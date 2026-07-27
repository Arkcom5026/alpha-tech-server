const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(path.join(__dirname, 'quickStockRoutes.js'), 'utf8')

assert.match(source, /router\.use\(verifyToken, allowQuickStockForEmployeeContext\)/)
assert.match(source, /router\.post\('\/receipts\/complete', quickReceiptSessionController\.complete\)/)
assert.match(source, /router\.get\('\/receipts', quickReceiptSessionController\.list\)/)
assert.match(source, /router\.post\('\/receipts', quickReceiptSessionController\.create\)/)
assert.match(source, /router\.get\('\/receipts\/:id', quickReceiptSessionController\.detail\)/)
assert.match(source, /router\.post\('\/receipts\/:id\/finalize', quickReceiptSessionController\.finalize\)/)
assert.match(source, /router\.post\('\/receipts\/:id\/cancel', quickReceiptSessionController\.cancel\)/)

const completeIndex = source.indexOf("router.post('/receipts/complete'")
const detailIndex = source.indexOf("router.get('/receipts/:id'")
assert(completeIndex >= 0 && detailIndex >= 0 && completeIndex < detailIndex, 'static /receipts/complete must be declared before dynamic /receipts/:id routes')

console.log('✅ quickStockRoutes quick receipt route contract passed')
