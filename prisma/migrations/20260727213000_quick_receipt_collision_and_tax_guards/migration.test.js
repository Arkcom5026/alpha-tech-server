const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const migration = fs.readFileSync(path.join(__dirname, 'migration.sql'), 'utf8')

assert.match(migration, /ON "StockItem" \(LOWER\("barcode"\)\)/)
assert.match(migration, /ON "SimpleLot" \(LOWER\("barcode"\)\)/)
assert.match(migration, /ON "StockItem" \(LOWER\("serialNumber"\)\)/)
assert.match(migration, /WHERE "serialNumber" IS NOT NULL/)

assert.match(migration, /"documentSubtotal" IS NULL OR "documentSubtotal" >= 0/)
assert.match(migration, /"documentVatAmount" IS NULL OR "documentVatAmount" >= 0/)
assert.match(migration, /"documentTotalAmount" IS NULL OR "documentTotalAmount" >= 0/)

console.log('✅ Quick Receipt collision and tax guard migration contract passed')
