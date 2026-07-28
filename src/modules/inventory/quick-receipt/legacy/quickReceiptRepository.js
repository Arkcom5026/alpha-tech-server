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

const toReceipt = (row) => row
  ? {
      id: row.id,
      status: row.status,
      finalizedAt: row.finalized_at ?? null,
      finalizeToken: row.finalize_token ?? null,
    }
  : null

const toReceiptItem = (row) => ({
  id: row.id,
  productId: row.product_id,
  qty: row.qty,
  unitCost: row.unit_cost,
  vatRate: row.vat_rate,
})

const toLotBarcode = (row) => ({
  code: row.code,
  productId: row.product_id,
})

const toStockMovement = (row) => ({
  productId: row.product_id ?? row.productId,
  qty: row.qty,
})

const toStockBalance = (row) => row
  ? {
      id: row.id,
      quantity: row.quantity,
    }
  : null

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

  createDraft({ source, supplierId, note, userId, branchId, createdAt, updatedAt }) {
    return this.insertWithId(TABLES.receipt, {
      source,
      supplier_id: supplierId || 0,
      note: note || '',
      status: 'DRAFT',
      branch_id: branchId || null,
      user_id: userId || null,
      created_at: createdAt,
      updated_at: updatedAt,
    })
  }

  async findReceipt(receiptId) {
    this.assertAvailable()
    return toReceipt(await this.db(TABLES.receipt).where({ id: receiptId }).first())
  }

  updateDraftItem(receiptId, itemId, body) {
    this.assertAvailable()
    return this.db(TABLES.item).where({ id: itemId, receipt_id: receiptId }).update({
      product_id: body.productId,
      qty: body.qty,
      unit_cost: body.unitCost ?? 0,
      vat_rate: body.vatRate ?? 0,
      idempotency_key: body.idempotencyKey || null,
      updated_at: body.updatedAt,
    })
  }

  createDraftItem({ receiptId, productId, qty, unitCost, vatRate, idempotencyKey, createdAt, updatedAt }) {
    return this.insertWithId(TABLES.item, {
      receipt_id: receiptId,
      product_id: productId,
      qty,
      unit_cost: unitCost ?? 0,
      vat_rate: vatRate ?? 0,
      idempotency_key: idempotencyKey || null,
      created_at: createdAt,
      updated_at: updatedAt,
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
    return toReceipt(await this.db(TABLES.receipt).where({ id: receiptId }).forUpdate().first())
  }

  async listReceiptItems(receiptId) {
    this.assertAvailable()
    return (await this.db(TABLES.item).where({ receipt_id: receiptId })).map(toReceiptItem)
  }

  async listLotBarcodes(receiptId) {
    this.assertAvailable()
    return (await this.db(TABLES.barcode)
      .select('code', 'product_id')
      .where({ receipt_id: receiptId, kind: 'LOT' }))
      .map(toLotBarcode)
  }

  async listReceiptMovements(receiptId) {
    this.assertAvailable()
    return (await this.db(TABLES.item)
      .select('product_id', 'qty')
      .where({ receipt_id: receiptId }))
      .map(toStockMovement)
  }

  async findStockBalance(branchId, productId) {
    this.assertAvailable()
    return toStockBalance(await this.db(TABLES.stock)
      .where({ branch_id: branchId, product_id: productId })
      .first())
  }

  updateStockBalance(id, quantity) {
    this.assertAvailable()
    return this.db(TABLES.stock).where({ id }).update({
      quantity,
      updated_at: this.now(),
    })
  }

  createStockBalance({ branchId, productId, quantity }) {
    this.assertAvailable()
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
