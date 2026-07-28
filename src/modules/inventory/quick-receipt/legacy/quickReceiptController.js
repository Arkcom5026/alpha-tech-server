// Legacy Quick Receipt controller retained temporarily under module ownership.
// Runtime behavior is intentionally unchanged until the Prisma vertical slice replaces it.

const asNumber = (v, def = 0) => {
  if (v === '' || v === null || v === undefined) return def
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

const getDb = (req) => {
  if (req?.app?.locals?.knex) return req.app.locals.knex
  try { return require('../../../../../db') } catch {}
  try { return require('../../../../../../db') } catch {}
  return null
}

const pickContext = (req) => ({
  userId: req.user?.id,
  branchId: req.user?.branchId,
  reqId: req.id || req.headers['x-request-id'] || undefined,
  ip: req.ip,
  db: getDb(req),
})

const send = (res, code, payload) => res.status(code).json(payload)

const T = {
  receipt: 'quick_receipts',
  item: 'quick_receipt_items',
  stock: 'stock_balances',
  barcode: 'barcodes',
}

const nowIso = () => new Date().toISOString()
const genBarcode = (productId) => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `QR${y}${m}${dd}-${productId}-${rand}`
}

const dbEnsureDraft = async ({ db, source, supplierId, note, userId, branchId }) => {
  if (!db) throw new Error('DB connection not available')

  const payload = {
    source,
    supplier_id: supplierId || 0,
    note: note || '',
    status: 'DRAFT',
    branch_id: branchId || null,
    user_id: userId || null,
    created_at: db.fn.now(),
    updated_at: db.fn.now(),
  }

  let id
  try {
    const rows = await db(T.receipt).insert(payload).returning('id')
    id = Array.isArray(rows) ? (rows[0]?.id ?? rows[0]) : rows
  } catch {
    const result = await db(T.receipt).insert(payload)
    id = Array.isArray(result) ? result[0] : result
  }

  return { id, status: 'DRAFT', source, supplierId, note }
}

const dbSaveDraftItem = async ({ db, receiptId, itemId, productId, qty, unitCost, vatRate, idempotencyKey }) => {
  if (!db) throw new Error('DB connection not available')
  if (!receiptId) throw new Error('missing receipt id')
  if (!productId || !qty) throw new Error('missing product or qty')

  const receipt = await db(T.receipt).where({ id: receiptId }).first()
  if (!receipt) throw Object.assign(new Error('receipt not found'), { status: 404, code: 'NOT_FOUND' })
  if (receipt.status !== 'DRAFT') throw Object.assign(new Error('receipt not in DRAFT'), { status: 409, code: 'CONFLICT' })

  const body = {
    receipt_id: receiptId,
    product_id: productId,
    qty,
    unit_cost: unitCost ?? 0,
    vat_rate: vatRate ?? 0,
    idempotency_key: idempotencyKey || null,
    updated_at: db.fn.now(),
  }

  let savedId = itemId
  if (itemId) {
    await db(T.item).where({ id: itemId, receipt_id: receiptId }).update(body)
  } else {
    body.created_at = db.fn.now()
    try {
      const rows = await db(T.item).insert(body).returning('id')
      savedId = Array.isArray(rows) ? (rows[0]?.id ?? rows[0]) : rows
    } catch {
      const result = await db(T.item).insert(body)
      savedId = Array.isArray(result) ? result[0] : result
    }
  }

  return { itemId: savedId }
}

const dbDeleteDraftItem = async ({ db, receiptId, itemId }) => {
  if (!db) throw new Error('DB connection not available')
  if (!receiptId || !itemId) throw new Error('missing id')

  const receipt = await db(T.receipt).where({ id: receiptId }).first()
  if (!receipt) throw Object.assign(new Error('receipt not found'), { status: 404, code: 'NOT_FOUND' })
  if (receipt.status !== 'DRAFT') throw Object.assign(new Error('receipt not in DRAFT'), { status: 409, code: 'CONFLICT' })

  await db(T.item).where({ id: itemId, receipt_id: receiptId }).del()
  return { ok: true }
}

const dbFinalize = async ({ db, receiptId, finalizeToken, userId, branchId }) => {
  if (!db) throw new Error('DB connection not available')
  if (!receiptId) throw new Error('missing receipt id')

  return db.transaction(async (trx) => {
    const receipt = await trx(T.receipt).where({ id: receiptId }).forUpdate().first()
    if (!receipt) throw Object.assign(new Error('receipt not found'), { status: 404, code: 'NOT_FOUND' })

    if (receipt.status === 'FINALIZED') {
      return {
        receiptId,
        committedAt: receipt.finalized_at || nowIso(),
        lotBarcodes: await trx(T.barcode).select('code', 'product_id').where({ receipt_id: receiptId, kind: 'LOT' }),
        stockMovements: await trx(T.item).select('product_id as productId', 'qty').where({ receipt_id: receiptId }),
      }
    }

    if (receipt.finalize_token && finalizeToken && receipt.finalize_token !== finalizeToken) {
      throw Object.assign(new Error('finalize token mismatch'), { status: 409, code: 'CONFLICT' })
    }

    const items = await trx(T.item).where({ receipt_id: receiptId })
    if (items.length === 0) throw Object.assign(new Error('no items to finalize'), { status: 409, code: 'EMPTY' })

    const lotBarcodes = []
    const stockMovements = []

    for (const it of items) {
      const existing = await trx(T.stock).where({ branch_id: branchId, product_id: it.product_id }).first()
      if (existing) {
        await trx(T.stock).where({ id: existing.id }).update({
          quantity: (existing.quantity || 0) + it.qty,
          updated_at: trx.fn.now(),
        })
      } else {
        await trx(T.stock).insert({
          branch_id: branchId,
          product_id: it.product_id,
          quantity: it.qty,
          created_at: trx.fn.now(),
          updated_at: trx.fn.now(),
        })
      }
      stockMovements.push({ productId: it.product_id, qty: it.qty })

      const code = genBarcode(it.product_id)
      await trx(T.barcode).insert({
        code,
        kind: 'LOT',
        product_id: it.product_id,
        receipt_id: receiptId,
        status: 'SN_RECEIVED',
        created_at: trx.fn.now(),
      })
      lotBarcodes.push({ productId: it.product_id, code })
    }

    const committedAt = nowIso()
    await trx(T.receipt).where({ id: receiptId }).update({
      status: 'FINALIZED',
      finalized_at: committedAt,
      finalize_token: finalizeToken || trx.raw('COALESCE(finalize_token, ?) ', [finalizeToken || null]),
      updated_at: trx.fn.now(),
    })

    return { receiptId, committedAt, lotBarcodes, stockMovements }
  })
}

const ensureDraft = async (req, res, next) => {
  try {
    const { source = 'QUICK_HYBRID', supplierId = 0, note = '' } = req.body || {}
    const ctx = pickContext(req)
    const out = await dbEnsureDraft({
      db: ctx.db,
      source,
      supplierId: asNumber(supplierId, 0),
      note: String(note || ''),
      userId: ctx.userId,
      branchId: ctx.branchId,
    })
    return send(res, 201, out)
  } catch (err) {
    return next(err)
  }
}

const saveItemDraft = async (req, res, next) => {
  try {
    const { id } = req.params
    if (!id) return send(res, 400, { code: 'INVALID', message: 'missing receipt id' })

    const { itemId, productId, qty, unitCost = 0, vatRate = 0 } = req.body || {}
    const idempotencyKey = req.get('X-Idempotency-Key')
    const ctx = pickContext(req)

    const out = await dbSaveDraftItem({
      db: ctx.db,
      receiptId: id,
      itemId: itemId || undefined,
      productId: asNumber(productId),
      qty: asNumber(qty),
      unitCost: asNumber(unitCost),
      vatRate: asNumber(vatRate),
      idempotencyKey: idempotencyKey || undefined,
    })
    return send(res, 200, out)
  } catch (err) {
    return next(err)
  }
}

const deleteItemDraft = async (req, res, next) => {
  try {
    const { id, itemId } = req.params
    if (!id || !itemId) return send(res, 400, { code: 'INVALID', message: 'missing id or itemId' })
    const ctx = pickContext(req)

    const out = await dbDeleteDraftItem({ db: ctx.db, receiptId: id, itemId })
    return send(res, 200, out)
  } catch (err) {
    return next(err)
  }
}

const finalize = async (req, res, next) => {
  try {
    const { id } = req.params
    if (!id) return send(res, 400, { code: 'INVALID', message: 'missing receipt id' })
    const finalizeToken = req.get('X-Finalize-Token')
    const ctx = pickContext(req)

    const out = await dbFinalize({
      db: ctx.db,
      receiptId: id,
      finalizeToken: finalizeToken || undefined,
      userId: ctx.userId,
      branchId: ctx.branchId,
    })
    return send(res, 200, out)
  } catch (err) {
    return next(err)
  }
}

module.exports = {
  ensureDraft,
  saveItemDraft,
  deleteItemDraft,
  finalize,
}
