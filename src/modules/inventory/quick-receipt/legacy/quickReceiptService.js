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
  constructor(repository) {
    this.repository = repository
  }

  async ensureDraft({ source, supplierId, note, userId, branchId }) {
    const timestamp = this.repository.now()
    const id = await this.repository.createDraft({
      source,
      supplier_id: supplierId || 0,
      note: note || '',
      status: 'DRAFT',
      branch_id: branchId || null,
      user_id: userId || null,
      created_at: timestamp,
      updated_at: timestamp,
    })

    return { id, status: 'DRAFT', source, supplierId, note }
  }

  async saveDraftItem({ receiptId, itemId, productId, qty, unitCost, vatRate, idempotencyKey }) {
    if (!receiptId) throw new Error('missing receipt id')
    if (!productId || !qty) throw new Error('missing product or qty')

    const receipt = await this.repository.findReceipt(receiptId)
    if (!receipt) throw legacyError('receipt not found', 404, 'NOT_FOUND')
    if (receipt.status !== 'DRAFT') throw legacyError('receipt not in DRAFT', 409, 'CONFLICT')

    const body = {
      receipt_id: receiptId,
      product_id: productId,
      qty,
      unit_cost: unitCost ?? 0,
      vat_rate: vatRate ?? 0,
      idempotency_key: idempotencyKey || null,
      updated_at: this.repository.now(),
    }

    let savedId = itemId
    if (itemId) {
      await this.repository.updateDraftItem(receiptId, itemId, body)
    } else {
      body.created_at = this.repository.now()
      savedId = await this.repository.createDraftItem(body)
    }

    return { itemId: savedId }
  }

  async deleteDraftItem({ receiptId, itemId }) {
    if (!receiptId || !itemId) throw new Error('missing id')

    const receipt = await this.repository.findReceipt(receiptId)
    if (!receipt) throw legacyError('receipt not found', 404, 'NOT_FOUND')
    if (receipt.status !== 'DRAFT') throw legacyError('receipt not in DRAFT', 409, 'CONFLICT')

    await this.repository.deleteDraftItem(receiptId, itemId)
    return { ok: true }
  }

  async finalize({ receiptId, finalizeToken, branchId }) {
    if (!receiptId) throw new Error('missing receipt id')

    return this.repository.transaction(async (repo) => {
      const receipt = await repo.findReceiptForUpdate(receiptId)
      if (!receipt) throw legacyError('receipt not found', 404, 'NOT_FOUND')

      if (receipt.status === 'FINALIZED') {
        return {
          receiptId,
          committedAt: receipt.finalized_at || nowIso(),
          lotBarcodes: await repo.listLotBarcodes(receiptId),
          stockMovements: await repo.listReceiptMovements(receiptId),
        }
      }

      if (receipt.finalize_token && finalizeToken && receipt.finalize_token !== finalizeToken) {
        throw legacyError('finalize token mismatch', 409, 'CONFLICT')
      }

      const items = await repo.listReceiptItems(receiptId)
      if (items.length === 0) throw legacyError('no items to finalize', 409, 'EMPTY')

      const lotBarcodes = []
      const stockMovements = []

      for (const item of items) {
        const existing = await repo.findStockBalance(branchId, item.product_id)
        if (existing) {
          await repo.updateStockBalance(existing.id, (existing.quantity || 0) + item.qty)
        } else {
          await repo.createStockBalance({
            branchId,
            productId: item.product_id,
            quantity: item.qty,
          })
        }

        stockMovements.push({ productId: item.product_id, qty: item.qty })

        const code = genBarcode(item.product_id)
        await repo.createLotBarcode({ code, productId: item.product_id, receiptId })
        lotBarcodes.push({ productId: item.product_id, code })
      }

      const committedAt = nowIso()
      await repo.finalizeReceipt(receiptId, committedAt, finalizeToken)

      return { receiptId, committedAt, lotBarcodes, stockMovements }
    })
  }
}

module.exports = { LegacyQuickReceiptService }
