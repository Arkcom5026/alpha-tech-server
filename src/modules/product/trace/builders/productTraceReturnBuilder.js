const { toIsoString } = require('../utils/productTraceDate')
const { roundMoney } = require('../utils/productTraceMoney')

const buildProductTraceReturns = (stockItem, permissions) =>
  (stockItem.saleItems || []).flatMap((saleItem) =>
    (saleItem.returnItems || []).map((returnItem) => {
      const saleReturn = returnItem.saleReturn
      return {
        returnItemId: returnItem.id,
        saleItemId: saleItem.id,
        saleId: saleItem.saleId,
        reason: returnItem.reason || null,
        reasonCode: returnItem.reasonCode || null,
        refundAmount: permissions.canViewFinancials ? roundMoney(returnItem.refundAmount) : null,
        saleReturn: saleReturn ? {
          id: saleReturn.id,
          code: saleReturn.code,
          returnedAt: toIsoString(saleReturn.returnedAt),
          stockRestoredAt: toIsoString(saleReturn.stockRestoredAt),
          completedAt: toIsoString(saleReturn.completedAt),
          returnType: saleReturn.returnType,
          reason: saleReturn.reason || null,
          status: saleReturn.status,
          refundMethod: saleReturn.refundMethod,
          isFullyRefunded: Boolean(saleReturn.isFullyRefunded),
          employee: saleReturn.employee ? { id: saleReturn.employee.id, name: saleReturn.employee.name || '-' } : null,
          refundedBy: saleReturn.refundedBy ? { id: saleReturn.refundedBy.id, name: saleReturn.refundedBy.name || '-' } : null,
        } : null,
        refundTransactions: (saleReturn?.refundTransaction || []).map((transaction) => ({
          id: transaction.id,
          amount: permissions.canViewFinancials ? roundMoney(transaction.amount) : null,
          deducted: permissions.canViewFinancials ? roundMoney(transaction.deducted) : null,
          method: transaction.method,
          refundedAt: toIsoString(transaction.refundedAt),
          refundedBy: transaction.refundedBy ? { id: transaction.refundedBy.id, name: transaction.refundedBy.name || '-' } : null,
          note: transaction.note || null,
        })),
      }
    })
  )

module.exports = { buildProductTraceReturns }
