'use strict'

const TABLES = {
  receipt: 'quick_receipts',
  item: 'quick_receipt_items',
  stock: 'stock_balances',
  barcode: 'barcodes',
}

const extractInsertedId = (result) => {
  if (Array.isArray(result)) return result[0]?.id ?? result[0] ?? null
  return result?.id ?? result ?? null
}

const normalizeReceipt = (row) => row
  ? {
      id: row.id,
      status: row.status,
      branchId: row.branch_id,
      userId: row.user_id,
      finalizedAt: row.finalized_at,
      finalizeToken: row.finalize_token,
    }
  : null

const normalizeItem = (row) => ({
  id: row.id,
  receiptId: row.receipt_id,
  productId: row.product_id,
  qty: row.qty,
  unitCost: row.unit_cost,
  vatRate: row.vat_rate,
  idempotencyKey: row.idempotency_key,
})

class LegacyQuickReceiptRepository {
  constructor(db) {
    this.db = db
  }

  assertAvailable() {
    if (!this.db) throw new Error('DB connection not available')
  }

  now() {
    this.assertAvailable()
    return this.db.fn.now()
  }

  async insertWithId(table, payload) {
    this.assertAvailable()

    try {
      return extractInsertedId(await this.db(table).insert(payload).returning('id'))
    } catch {
      return extractInsertedId(await this.db(table).insert(payload))
    }
  }

  createDraft({ source, supplierId, note, userId, branchId }) {
    const timestamp = this.now()
    return this.insertWithId(TABLES.receipt, {
      source,
      supplier_id: supplierId || 0,
      note: note || '',
      status: 'DRAFT',
      branch_id: branchId || null,
      user_id: userId || null,
      created_at: timestamp,
      updated_at: timestamp,
    })
  }

  async findReceipt(receiptId) {
    this.assertAvailable()
    return normalizeReceipt(await this.db(TABLES.receipt).where({ id: receiptId }).first())
  }

  async updateDraftItem(receiptId, itemId, item) {
    this.assertAvailable()
    const updated = await this.db(TABLES.item).where({ id: itemId, receipt_id: receiptId }).update({
      product_id: item.productId,
      qty: item.qty,
      unit_cost: item.unitCost ?? 0,
      vat_rate: item.vatRate ?? 0,
      idempotency_key: item.idempotencyKey || null,
      updated_at: this.now(),
    })
    return Number(updated) > 0 ? itemId : null
  }

  createDraftItem(item) {
    const timestamp = this.now()
    return this.insertWithId(TABLES.item, {
      receipt_id: item.receiptId,
      product_id: item.productId,
      qty: item.qty,
      unit_cost: item.unitCost ?? 0,
      vat_rate: item.vatRate ?? 0,
      idempotency_key: item.idempotencyKey || null,
      created_at: timestamp,
      updated_at: timestamp,
    })
  }

  deleteDraftItem(receiptId, itemId) {
    this.assertAvailable()
    return this.db(TABLES.item).where({ id: itemId, receipt_id: receiptId }).del()
  }

  transaction(work) {
    this.assertAvailable()
    return this.db.transaction((trx) => work(new LegacyQuickReceiptRepository(trx)))
  }

  async findReceiptForUpdate(receiptId) {
    this.assertAvailable()
    return normalizeReceipt(
      await this.db(TABLES.receipt).where({ id: receiptId }).forUpdate().first()
    )
  }

  async listReceiptItems(receiptId) {
    this.assertAvailable()
    return (await this.db(TABLES.item).where({ receipt_id: receiptId })).map(normalizeItem)
  }

  async listLotBarcodes(receiptId) {
    this.assertAvailable()
    const rows = await this.db(TABLES.barcode)
      .select('code', 'product_id')
      .where({ receipt_id: receiptId, kind: 'LOT' })
    return rows.map((row) => ({ code: row.code, productId: row.product_id }))
  }

  async listReceiptMovements(receiptId) {
    this.assertAvailable()
    const rows = await this.db(TABLES.item)
      .select('product_id', 'qty')
      .where({ receipt_id: receiptId })
    return rows.map((row) => ({ productId: row.product_id, qty: row.qty }))
  }

  async increaseStockBalance({ branchId, productId, quantity }) {
    this.assertAvailable()
    const existing = await this.db(TABLES.stock)
      .where({ branch_id: branchId, product_id: productId })
      .first()

    if (existing) {
      return this.db(TABLES.stock).where({ id: existing.id }).update({
        quantity: (existing.quantity || 0) + quantity,
        updated_at: this.now(),
      })
    }

    const timestamp = this.now()
    return this.db(TABLES.stock).insert({
      branch_id: branchId,
      product_id: productId,
      quantity,
      created_at: timestamp,
      updated_at: timestamp,
    })
  }

  createLotBarcode({ code, productId, receiptId }) {
    this.assertAvailable()
    return this.db(TABLES.barcode).insert({
      code,
      kind: 'LOT',
      product_id: productId,
      receipt_id: receiptId,
      status: 'SN_RECEIVED',
      created_at: this.now(),
    })
  }

  finalizeReceipt(receiptId, committedAt, finalizeToken) {
    this.assertAvailable()
    return this.db(TABLES.receipt).where({ id: receiptId }).update({
      status: 'FINALIZED',
      finalized_at: committedAt,
      finalize_token: finalizeToken || this.db.raw('COALESCE(finalize_token, ?) ', [finalizeToken || null]),
      updated_at: this.now(),
    })
  }
}

module.exports = { LegacyQuickReceiptRepository }
