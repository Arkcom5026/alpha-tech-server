const { createProductTraceSummary } = require('../contracts/productTraceSummaryContract')
const { roundMoney, sumMoney, calculateMarginPercent } = require('../utils/productTraceMoney')

const buildProductTraceSummary = ({ stockItem, returns, permissions }) => {
  if (!permissions.canViewFinancials) return createProductTraceSummary({ financialsVisible: false })
  const saleItems = stockItem.saleItems || []
  const latest = saleItems[saleItems.length - 1] || null
  const cost = roundMoney(stockItem.costPrice ?? stockItem.purchaseOrderReceiptItem?.costPrice)
  const saleBasePrice = roundMoney(latest?.basePrice)
  const saleDiscount = roundMoney(latest?.discount)
  const netSale = roundMoney(sumMoney(saleItems.map((item) => item.price)))
  const refundTotal = roundMoney(sumMoney((returns || []).map((item) => item.refundAmount))) || 0
  const netRevenueAfterRefund = netSale === null ? null : roundMoney(netSale - refundTotal)
  const grossProfitBeforeRefund = netSale === null || cost === null ? null : roundMoney(netSale - cost)
  const grossProfitAfterRefund = netRevenueAfterRefund === null || cost === null ? null : roundMoney(netRevenueAfterRefund - cost)
  return createProductTraceSummary({
    cost, saleBasePrice, saleDiscount, netSale, refundTotal, netRevenueAfterRefund,
    grossProfitBeforeRefund, grossProfitAfterRefund,
    grossMarginPercentBeforeRefund: calculateMarginPercent(grossProfitBeforeRefund, netSale),
    grossMarginPercentAfterRefund: calculateMarginPercent(grossProfitAfterRefund, netRevenueAfterRefund),
    financialsVisible: true,
  })
}

module.exports = { buildProductTraceSummary }
