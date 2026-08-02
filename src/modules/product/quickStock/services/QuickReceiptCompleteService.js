const crypto = require('node:crypto')

const QuickReceiptSessionService = require('./QuickReceiptSessionService')
const priceAuthorityPolicy = require('../../pricing/policies/priceAuthorityPolicy')

const cleanText = (value) => String(value || '').trim()
const normalizeDeliveryNote = (value) => cleanText(value).replace(/\s+/g, '').toUpperCase()
const asNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
const normalizeDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : null)
const makeError = (message, statusCode = 400, code = 'QUICK_RECEIPT_COMPLETE_FAILED') => {
  const error = new Error(message)
  error.statusCode = statusCode
  error.code = code
  return error
}

const normalizeUnits = (items) => (Array.isArray(items) ? items : [])
  .map((item) => ({
    barcode: cleanText(item?.barcode),
    serialNumber: cleanText(item?.serialNumber) || null,
  }))
  .filter((item) => item.barcode)
  .sort((left, right) => `${left.barcode}:${left.serialNumber || ''}`.localeCompare(`${right.barcode}:${right.serialNumber || ''}`))

const normalizeLine = (line) => ({
  productId: asNumber(line?.productId),
  quantity: asNumber(line?.quantity),
  costPrice: asNumber(line?.costPrice),
  priceRetail: asNumber(line?.priceRetail),
  priceWholesale: asNumber(line?.priceWholesale),
  priceTechnician: asNumber(line?.priceTechnician),
  priceOnline: asNumber(line?.priceOnline),
  note: cleanText(line?.note) || null,
  items: normalizeUnits(line?.items),
})

const canonicalPayload = (payload) => {
  const lines = (Array.isArray(payload?.items) ? payload.items : [])
    .map(normalizeLine)
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))

  return {
    supplierId: asNumber(payload?.supplierId),
    deliveryNoteNumber: normalizeDeliveryNote(payload?.deliveryNoteNumber),
    deliveryNoteDate: normalizeDate(payload?.deliveryNoteDate),
    note: cleanText(payload?.note) || null,
    taxDocumentMode: cleanText(payload?.taxDocumentMode || 'NOT_RECEIVED').toUpperCase(),
    supplierTaxInvoiceNumber: cleanText(payload?.supplierTaxInvoiceNumber) || null,
    supplierTaxInvoiceDate: normalizeDate(payload?.supplierTaxInvoiceDate),
    taxPricingMode: cleanText(payload?.taxPricingMode).toUpperCase() || null,
    documentSubtotal: asNumber(payload?.documentSubtotal),
    documentVatAmount: asNumber(payload?.documentVatAmount),
    documentTotalAmount: asNumber(payload?.documentTotalAmount),
    items: lines,
  }
}

const payloadHash = (payload) => crypto
  .createHash('sha256')
  .update(JSON.stringify(canonicalPayload(payload)))
  .digest('hex')

class QuickReceiptCompleteService {
  constructor(prisma) {
    this.prisma = prisma
    this.sessions = new QuickReceiptSessionService(prisma)
  }

  async complete(payload, actor = {}, commandKey) {
    const authority = priceAuthorityPolicy.assertActor(actor)
    const key = cleanText(commandKey)
    if (!key) throw makeError('ต้องมี X-Idempotency-Key', 400, 'IDEMPOTENCY_KEY_REQUIRED')

    const lines = Array.isArray(payload?.items) ? payload.items : []
    if (!lines.length) {
      throw makeError('ยังไม่มีสินค้าในใบรับ', 400, 'RECEIPT_ITEMS_REQUIRED')
    }

    for (const [index, line] of lines.entries()) {
      try {
        priceAuthorityPolicy.assertPricePayload({
          actor: authority,
          payload: {
            costPrice: line?.costPrice,
            priceRetail: line?.priceRetail,
            priceWholesale: line?.priceWholesale,
            priceTechnician: line?.priceTechnician,
            priceOnline: line?.priceOnline,
          },
        })
      } catch (error) {
        error.detail = { ...(error.detail || {}), lineIndex: index }
        throw error
      }
    }

    const incomingHash = payloadHash(payload)
    const priorCommands = await this.prisma.$queryRawUnsafe(
      `SELECT "receiptId" FROM "QuickReceiptFinalizeCommand"
       WHERE "branchId"=$1 AND "commandKey"=$2 LIMIT 1`,
      authority.branchId,
      key
    )
    if (priorCommands.length) {
      const priorReceipt = await this.sessions.getReceipt(priorCommands[0].receiptId, authority)
      const priorHash = payloadHash(priorReceipt)
      if (priorHash !== incomingHash) {
        throw makeError(
          'X-Idempotency-Key นี้ถูกใช้กับข้อมูลใบรับสินค้าอื่นแล้ว',
          409,
          'IDEMPOTENCY_KEY_CONFLICT'
        )
      }
      return priorReceipt
    }

    let receipt = null
    try {
      receipt = await this.sessions.createDraft(payload, authority)
      for (const line of lines) {
        receipt = await this.sessions.addItem(receipt.id, line, authority)
      }
      return await this.sessions.finalize(receipt.id, authority, key)
    } catch (error) {
      if (receipt?.id) {
        try {
          const latest = await this.sessions.getReceipt(receipt.id, authority)
          if (latest.status === 'DRAFT') {
            await this.sessions.cancel(
              receipt.id,
              authority,
              `ONE_SHOT_PREPARATION_FAILED: ${error?.code || error?.message || 'UNKNOWN'}`
            )
          }
        } catch (_cleanupError) {}
      }
      throw error
    }
  }
}

module.exports = QuickReceiptCompleteService
module.exports.canonicalPayload = canonicalPayload
module.exports.payloadHash = payloadHash
