const createProductTraceSummary = ({
  cost = null,
  saleBasePrice = null,
  saleDiscount = null,
  netSale = null,
  refundTotal = 0,
  netRevenueAfterRefund = null,
  grossProfitBeforeRefund = null,
  grossProfitAfterRefund = null,
  grossMarginPercentBeforeRefund = null,
  grossMarginPercentAfterRefund = null,
  financialsVisible = false,
}) => ({
  cost,
  saleBasePrice,
  saleDiscount,
  netSale,
  refundTotal,
  netRevenueAfterRefund,
  grossProfitBeforeRefund,
  grossProfitAfterRefund,
  grossMarginPercentBeforeRefund,
  grossMarginPercentAfterRefund,
  financialsVisible,
})

module.exports = {
  createProductTraceSummary,
}
