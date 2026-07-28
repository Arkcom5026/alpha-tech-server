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

  createDraft(payload) {
    return this.insertWithId(TABLES.receipt, payload)
  }

  findReceipt(receiptId) {
    this.assertAvailable()
    return this.db(TABLES.receipt).where({ id: receiptId }).first()
  }

  updateDraftItem(receiptId, itemId, body) {
    this.assertAvailable()
    return this.db(TABLES.item).where({ id: itemId, receipt_id: receiptId }).update(body)
  }

  createDraftItem(body) {
    return this.insertWithId(TABLES.item, body)
  }

  deleteDraftItem(receiptId, itemId) {
    this.assertAvailable()
    return this.db(TABLES.item).where({ id: itemId, receipt_id: receiptId }).del()
  }

  transaction(work) {
    this.assertAvailable()
    return this.db.transaction((trx) => work(new LegacyQuickReceiptRepository(trx)))
  }

  findReceiptForUpdate(receiptId) {
    this.assertAvailable()
    return this.db(TABLES.receipt).where({ id: receiptId }).forUpdate().first()
  }

  listReceiptItems(receiptId) {
    this.assertAvailable()
    return this.db(TABLES.item).where({ receipt_id: receiptId })
  }

  listLotBarcodes(receiptId) {
    this.assertAvailable()
    return this.db(TABLES.barcode)
      .select('code', 'product_id')
      .where({ receipt_id: receiptId, kind: 'LOT' })
  }

  listReceiptMovements(receiptId) {
    this.assertAvailable()
    return this.db(TABLES.item)
      .select('product_id as productId', 'qty')
      .where({ receipt_id: receiptId })
  }

  findStockBalance(branchId, productId) {
    this.assertAvailable()
    return this.db(TABLES.stock)
      .where({ branch_id: branchId, product_id: productId })
      .first()
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
