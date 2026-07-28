'use strict'

const TABLES = {
  receipt: 'quick_receipts',
  item: 'quick_receipt_items',
  stock: 'stock_balances',
  barcode: 'barcodes',
}

class LegacyQuickReceiptRepository {
  constructor(db) {
    this.db = db
  }

  assertAvailable() {
    if (!this.db) throw new Error('DB connection not available')
  }

  createDraft(payload) {
    this.assertAvailable()
    return this.db(TABLES.receipt).insert(payload).returning('id')
  }

  createDraftWithoutReturning(payload) {
    this.assertAvailable()
    return this.db(TABLES.receipt).insert(payload)
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
    this.assertAvailable()
    return this.db(TABLES.item).insert(body).returning('id')
  }

  createDraftItemWithoutReturning(body) {
    this.assertAvailable()
    return this.db(TABLES.item).insert(body)
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
    return this.db(TABLES.receipt).where({ id: receiptId }).forUpdate().first()
  }

  listReceiptItems(receiptId) {
    return this.db(TABLES.item).where({ receipt_id: receiptId })
  }

  listLotBarcodes(receiptId) {
    return this.db(TABLES.barcode)
      .select('code', 'product_id')
      .where({ receipt_id: receiptId, kind: 'LOT' })
  }

  listReceiptMovements(receiptId) {
    return this.db(TABLES.item)
      .select('product_id as productId', 'qty')
      .where({ receipt_id: receiptId })
  }

  findStockBalance(branchId, productId) {
    return this.db(TABLES.stock)
      .where({ branch_id: branchId, product_id: productId })
      .first()
  }

  updateStockBalance(id, quantity) {
    return this.db(TABLES.stock).where({ id }).update({
      quantity,
      updated_at: this.db.fn.now(),
    })
  }

  createStockBalance({ branchId, productId, quantity }) {
    return this.db(TABLES.stock).insert({
      branch_id: branchId,
      product_id: productId,
      quantity,
      created_at: this.db.fn.now(),
      updated_at: this.db.fn.now(),
    })
  }

  createLotBarcode({ code, productId, receiptId }) {
    return this.db(TABLES.barcode).insert({
      code,
      kind: 'LOT',
      product_id: productId,
      receipt_id: receiptId,
      status: 'SN_RECEIVED',
      created_at: this.db.fn.now(),
    })
  }

  finalizeReceipt(receiptId, committedAt, finalizeToken) {
    return this.db(TABLES.receipt).where({ id: receiptId }).update({
      status: 'FINALIZED',
      finalized_at: committedAt,
      finalize_token: finalizeToken || this.db.raw('COALESCE(finalize_token, ?) ', [finalizeToken || null]),
      updated_at: this.db.fn.now(),
    })
  }
}

module.exports = { LegacyQuickReceiptRepository }
