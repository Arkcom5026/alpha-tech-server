const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(path.join(__dirname, 'quickReceiptSessionController.js'), 'utf8')

assert.match(source, /requireActor\(req, res\)/)
assert.match(source, /service\.createDraft\(req\.body \|\| \{\}, actor\.branchId, actor\.employeeId\)/)
assert.match(source, /service\.complete\(req\.body \|\| \{\}, actor\.branchId, actor\.employeeId, req\.get\('X-Idempotency-Key'\)\)/)
assert.match(source, /service\.finalize\(req\.params\.id, actor\.branchId, actor\.employeeId, req\.get\('X-Idempotency-Key'\)\)/)
assert.match(source, /service\.cancel\(req\.params\.id, actor\.branchId, req\.body\?\.reason\)/)
assert.match(source, /code: error\?\.code \|\| 'QUICK_RECEIPT_FAILED'/)
assert.match(source, /details: error\?\.details/)

console.log('✅ quickReceiptSessionController HTTP contract passed')
