const QuickReceiptSessionService = require('./QuickReceiptSessionService')

const makeError = (message, statusCode = 400, code = 'QUICK_RECEIPT_COMPLETE_FAILED') => {
  const error = new Error(message)
  error.statusCode = statusCode
  error.code = code
  return error
}

/**
 * One HTTP command for the small-delivery workflow.
 *
 * Inventory mutation remains all-or-nothing because SessionService.finalize()
 * owns the inventory transaction. Receipt preparation is compensating-safe:
 * an incomplete preparation is cancelled so it cannot be resumed accidentally.
 */
class QuickReceiptCompleteService {
  constructor(prisma) {
    this.sessions = new QuickReceiptSessionService(prisma)
  }

  async complete(payload, branchId, employeeId, commandKey) {
    const lines = Array.isArray(payload?.items) ? payload.items : []
    if (!lines.length) {
      throw makeError('ยังไม่มีสินค้าในใบรับ', 400, 'RECEIPT_ITEMS_REQUIRED')
    }

    let receipt = null
    try {
      receipt = await this.sessions.createDraft(payload, branchId, employeeId)
      for (const line of lines) {
        receipt = await this.sessions.addItem(receipt.id, line, branchId)
      }
      return await this.sessions.finalize(receipt.id, branchId, employeeId, commandKey)
    } catch (error) {
      if (receipt?.id) {
        try {
          const latest = await this.sessions.getReceipt(receipt.id, branchId)
          if (latest.status === 'DRAFT') {
            await this.sessions.cancel(
              receipt.id,
              branchId,
              `ONE_SHOT_PREPARATION_FAILED: ${error?.code || error?.message || 'UNKNOWN'}`
            )
          }
        } catch (_cleanupError) {
          // Preserve the originating failure. A remaining DRAFT is recoverable and auditable.
        }
      }
      throw error
    }
  }
}

module.exports = QuickReceiptCompleteService
