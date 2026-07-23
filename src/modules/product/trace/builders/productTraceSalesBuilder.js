const { toIsoString } = require('../utils/productTraceDate')
const { roundMoney, sumMoney } = require('../utils/productTraceMoney')

const buildCustomer = (customer, permissions) => customer ? {
  id: customer.id, type: customer.type, name: customer.name || null,
  companyName: customer.companyName || null,
  phone: permissions.canViewCustomerContact ? customer.user?.loginId || null : null,
  email: permissions.canViewCustomerContact ? customer.user?.email || null : null,
  taxId: customer.taxId || null,
} : null

const buildCycle = (saleItem, permissions) => {
  const sale = saleItem?.sale
  if (!sale) return null
  return {
    saleItemId: saleItem.id,
    sale: {
      id: sale.id, code: sale.code, status: sale.status, statusPayment: sale.statusPayment,
      soldAt: toIsoString(sale.soldAt), paidAt: toIsoString(sale.paidAt),
      isCredit: Boolean(sale.isCredit), isTaxInvoice: Boolean(sale.isTaxInvoice),
      officialDocumentNumber: sale.officialDocumentNumber || null,
      employee: sale.employee ? { id: sale.employee.id, name: sale.employee.name || '-' } : null,
      customer: buildCustomer(sale.customer, permissions),
    },
    pricing: permissions.canViewFinancials ? {
      basePrice: roundMoney(saleItem.basePrice), discount: roundMoney(saleItem.discount),
      netPrice: roundMoney(saleItem.price), vatAmount: roundMoney(saleItem.vatAmount),
      refundedAmount: roundMoney(saleItem.refundedAmount),
    } : null,
    payments: (sale.payments || []).map((payment) => ({
      id: payment.id, code: payment.code, receivedAt: toIsoString(payment.receivedAt),
      isCancelled: Boolean(payment.isCancelled), cancelledAt: toIsoString(payment.cancelledAt),
      receivedBy: payment.employeeProfile ? { id: payment.employeeProfile.id, name: payment.employeeProfile.name || '-' } : null,
      totalAmount: roundMoney(sumMoney((payment.items || []).map((item) => item.amount))),
      items: (payment.items || []).map((item) => ({ id: item.id, method: item.paymentMethod, amount: roundMoney(item.amount), note: item.note || null })),
    })),
  }
}

const buildProductTraceSales = (stockItem, permissions) => {
  const cycles = (stockItem.saleItems || []).map((item) => buildCycle(item, permissions)).filter(Boolean)
  if (!cycles.length) return null
  return { ...cycles[cycles.length - 1], cycles }
}

module.exports = { buildProductTraceSales }
