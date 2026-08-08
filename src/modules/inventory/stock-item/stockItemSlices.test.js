const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const receipt = require('./receipt/stockItemReceiptSlices')
const lifecycle = require('./lifecycle/stockItemLifecycleSlices')
const receive = require('./receive/stockItemReceiveSlices')
const query = require('./query/stockItemQuerySlices')

function responseRecorder() {
  const state = { status: 200, body: undefined, headers: undefined }
  return {
    state,
    status(code) { state.status = code; return this },
    json(body) { state.body = body; return this },
    set(headers) { state.headers = headers; return this },
  }
}

test('receipt creation requires authenticated branch authority', async () => {
  const res = responseRecorder()
  await receipt.addStockItemFromReceipt({ user: {}, body: {} }, res)
  assert.equal(res.state.status, 401)
  assert.equal(res.state.body.message, 'Unauthorized: missing branch context')
})

test('receipt query validates receipt identity before persistence', async () => {
  const res = responseRecorder()
  await receipt.getStockItemsByReceipt({ user: { branchId: 7 }, params: { receiptId: 'x' } }, res)
  assert.equal(res.state.status, 400)
  assert.equal(res.state.body.message, 'receiptId ไม่ถูกต้อง')
})

test('lifecycle rejects direct SOLD status transitions', async () => {
  const res = responseRecorder()
  await lifecycle.updateStockItemStatus({ user: { branchId: 3 }, params: { id: 1 }, body: { status: 'SOLD' } }, res)
  assert.equal(res.state.status, 400)
  assert.match(res.state.body.message, /markStockItemsAsSold/)
})

test('mark sold requires a non-empty stock item list', async () => {
  const res = responseRecorder()
  await lifecycle.markStockItemsAsSold({ user: { branchId: 3 }, body: { stockItemIds: [] } }, res)
  assert.equal(res.state.status, 400)
  assert.equal(res.state.body.message, 'stockItemIds ต้องเป็น array')
})

test('single receive requires a normalized barcode', async () => {
  const res = responseRecorder()
  await receive.receiveStockItem({ user: { branchId: 3 }, body: {} }, res)
  assert.equal(res.state.status, 400)
  assert.equal(res.state.body.error, 'Missing or invalid barcode.')
})

test('bulk receive validates receipt identity', async () => {
  const res = responseRecorder()
  await receive.receiveAllPendingNoSN({ user: { branchId: 3 }, body: {} }, res)
  assert.equal(res.state.status, 400)
  assert.equal(res.state.body.error, 'receiptId ไม่ถูกต้อง')
})

test('search requires both query and branch authority', async () => {
  const res = responseRecorder()
  await query.searchStockItem({ user: {}, query: {} }, res)
  assert.equal(res.state.status, 400)
  assert.equal(res.state.body.error, 'Missing query or branchId')
})

test('stock item routes are owned and mounted by inventory slices', () => {
  const server = require('../../../../scripts/read-server-composition-source').readServerCompositionSource()
  const routePath = path.join(__dirname, 'routes/stockItemRoutes.js')
  const source = fs.readFileSync(routePath, 'utf8')

  assert.match(server, /require\('\.\/src\/modules\/inventory\/stock-item\/routes\/stockItemRoutes'\)/)
  assert.match(server, /app\.use\('\/api\/stock-items', stockItemRoutes\)/)
  assert.doesNotMatch(source, /controllers\/stockItemController/)
  assert.match(source, /receive-all-no-sn/)
  assert.match(source, /update-sn\/:barcode/)
})
