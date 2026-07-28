'use strict'

const nowIso = () => new Date().toISOString()

const genBarcode = (productId) => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `QR${y}${m}${dd}-${productId}-${rand}`
}

const legacyError = (message, status, code) => Object.assign(new Error(message), { status, code })

class LegacyQuickReceiptService {
  constructor(repository, { clock = nowIso, barcodeFactory = genBarcode } = {}) {
    this.repository = repository
    this.clock = clock
    this.barcodeFactory = barcodeFactory
  }

  assertBranchOwnership(receipt, branchId) {
    if (!branchId || Number(receipt.branchId) !== Number(branchId)) {
      throw legacyError('receipt not found', 404, 'NOT_FOUND')
    }
  }

  async ensureDraft({ source, supplierId, note, userId, branchId }) {
    const id = await this.repository.createDraft({
      source,
      supplierId,
      note,
      userId,
      branchId,
    })

    return { id, status: 'DRAFT', source, supplierId, note }
  }

  async saveDraftItem({ receiptId, itemId, productId, qty, unitCost, vatRate, idempotencyKey, branchId }) {
    if (!receiptId) throw new Error('missing receipt id')
    if (!productId || !qty) throw new Error('missing product or qty')

    const receipt = await this.repository.findReceipt(receiptId)
    if (!receipt) throw legacyError('receipt not found', 404, 'NOT_FOUND')
    this.assertBranchOwnership(receipt, branchId)
    if (receipt.status !== 'DRAFT') throw legacyError('receipt not in DRAFT', 409, 'CONFLICT')

    const item = {
      receiptId,
      productId,
      qty,
      unitCost,
      vatRate,
      idempotencyKey,
    }

    const savedId = itemId
      ? await this.repository.updateDraftItem(receiptId, itemId, item)
      : await this.repository.createDraftItem(item)

    if (!savedId) throw legacyError('receipt item not found', 404, 'NOT_FOUND')
    return { itemId: savedId }
  }

  async deleteDraftItem({ receiptId, itemId, branchId }) {
    if (!receiptId || !itemId) throw new Error('missing id')

    const receipt = await this.repository.findReceipt(receiptId)
    if (!receipt) throw legacyError('receipt not found', 404, 'NOT_FOUND')
    this.assertBranchOwnership(receipt, branchId)
    if (receipt.status !== 'DRAFT') throw legacyError('receipt not in DRAFT', 409, 'CONFLICT')

    const deleted = await this.repository.deleteDraftItem(receiptId, itemId)
    if (Number(deleted) === 0) throw legacyError('receipt item not found', 404, 'NOT_FOUND')
    return { ok: true }
  }

  async finalize({ receiptId, finalizeToken, branchId }) {
    if (!receiptId) throw new Error('missing receipt id')

    return this.repository.transaction(async (repo) => {
      const receipt = await repo.findReceiptForUpdate(receiptId)
      if (!receipt) throw legacyError('receipt not found', 404, 'NOT_FOUND')
      this.assertBranchOwnership(receipt, branchId)

      if (receipt.status === 'FINALIZED') {
        return {
          receiptId,
          committedAt: receipt.finalizedAt || this.clock(),
          lotBarcodes: await repo.listLotBarcodes(receiptId),
          stockMovements: await repo.listReceiptMovements(receiptId),
        }
      }

      if (receipt.finalizeToken && finalizeToken && receipt.finalizeToken !== finalizeToken) {
        throw legacyError('finalize token mismatch', 409, 'CONFLICT')
      }

      const items = await repo.listReceiptItems(receiptId)
      if (items.length === 0) throw legacyError('no items to finalize', 409, 'EMPTY')

      const lotBarcodes = []
      const stockMovements = []

      for (const item of items) {
        await repo.increaseStockBalance({
          branchId,
          productId: item.productId,
          quantity: item.qty,
        })

        stockMovements.push({ productId: item.productId, qty: item.qty })

        const code = this.barcodeFactory(item.productId)
        await repo.createLotBarcode({ code, productId: item.productId, receiptId })
        lotBarcodes.push({ productId: item.productId, code })
      }

      const committedAt = this.clock()
      await repo.finalizeReceipt(receiptId, committedAt, finalizeToken)

      return { receiptId, committedAt, lotBarcodes, stockMovements }
    })
  }
}

module.exports = { LegacyQuickReceiptService }
