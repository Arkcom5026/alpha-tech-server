const { createProductTraceSummary } = require('../contracts/productTraceSummaryContract')
const {
  roundMoney,
  sumMoney,
  calculateMarginPercent,
} = require('../utils/productTraceMoney')

const buildProductTraceSummary = ({ stockItem, returns, permissions }) => {
  if (!permissions.canViewFinancials) {
    return createProductTraceSummary({ financialsVisible: false })
  }

  const saleItem = stockItem.saleItem || null
  const cost = roundMoney(
    stockItem.costPrice ?? stockItem.purchaseOrderReceiptItem?.costPrice
  )
  const saleBasePrice = roundMoney(saleItem?.basePrice)
  const saleDiscount = roundMoney(saleItem?.discount)
  const netSale = roundMoney(saleItem?.price)
  const refundTotal = roundMoney(sumMoney(
    (returns || []).map((item) => item.refundAmount)
  )) || 0
  const netRevenueAfterRefund = netSale === null
    ? null
    : roundMoney(netSale - refundTotal)
  const grossProfitBeforeRefund = netSale === null || cost === null
    ? null
    : roundMoney(netSale - cost)
  const grossProfitAfterRefund = netRevenueAfterRefund === null || cost === null
    ? null
    : roundMoney(netRevenueAfterRefund - cost)

  return createProductTraceSummary({
    cost,
    saleBasePrice,
    saleDiscount,
    netSale,
    refundTotal,
    netRevenueAfterRefund,
    grossProfitBeforeRefund,
    grossProfitAfterRefund,
    grossMarginPercentBeforeRefund: calculateMarginPercent(grossProfitBeforeRefund, netSale),
    grossMarginPercentAfterRefund: calculateMarginPercent(grossProfitAfterRefund, netRevenueAfterRefund),
    financialsVisible: true,
  })
}

module.exports = {
  buildProductTraceSummary,
}
