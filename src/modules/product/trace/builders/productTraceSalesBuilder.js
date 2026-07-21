const { toIsoString } = require('../utils/productTraceDate')
const { roundMoney, sumMoney } = require('../utils/productTraceMoney')

const buildCustomer = (customer, permissions) => {
  if (!customer) return null
  return {
    id: customer.id,
    type: customer.type,
    name: customer.name || null,
    companyName: customer.companyName || null,
    phone: permissions.canViewCustomerContact ? customer.user?.loginId || null : null,
    email: permissions.canViewCustomerContact ? customer.user?.email || null : null,
    taxId: customer.taxId || null,
  }
}

const buildProductTraceSales = (stockItem, permissions) => {
  const saleItem = stockItem.saleItem || null
  const sale = saleItem?.sale || null
  if (!saleItem || !sale) return null

  const payments = (sale.payments || []).map((payment) => ({
    id: payment.id,
    code: payment.code,
    receivedAt: toIsoString(payment.receivedAt),
    isCancelled: Boolean(payment.isCancelled),
    cancelledAt: toIsoString(payment.cancelledAt),
    receivedBy: payment.employeeProfile
      ? { id: payment.employeeProfile.id, name: payment.employeeProfile.name || '-' }
      : null,
    totalAmount: roundMoney(sumMoney((payment.items || []).map((item) => item.amount))),
    items: (payment.items || []).map((item) => ({
      id: item.id,
      method: item.paymentMethod,
      amount: roundMoney(item.amount),
      note: item.note || null,
    })),
  }))

  return {
    saleItemId: saleItem.id,
    sale: {
      id: sale.id,
      code: sale.code,
      status: sale.status,
      statusPayment: sale.statusPayment,
      soldAt: toIsoString(sale.soldAt),
      paidAt: toIsoString(sale.paidAt),
      isCredit: Boolean(sale.isCredit),
      isTaxInvoice: Boolean(sale.isTaxInvoice),
      officialDocumentNumber: sale.officialDocumentNumber || null,
      employee: sale.employee
        ? { id: sale.employee.id, name: sale.employee.name || '-' }
        : null,
      customer: buildCustomer(sale.customer, permissions),
    },
    pricing: permissions.canViewFinancials
      ? {
          basePrice: roundMoney(saleItem.basePrice),
          discount: roundMoney(saleItem.discount),
          netPrice: roundMoney(saleItem.price),
          vatAmount: roundMoney(saleItem.vatAmount),
          refundedAmount: roundMoney(saleItem.refundedAmount),
        }
      : null,
    payments,
  }
}

module.exports = {
  buildProductTraceSales,
}
