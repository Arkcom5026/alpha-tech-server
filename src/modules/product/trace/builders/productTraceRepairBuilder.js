const { toIsoString } = require('../utils/productTraceDate')
const { roundMoney } = require('../utils/productTraceMoney')

const buildProductTraceRepairs = (stockItem, permissions) =>
  (stockItem.repairJobs || []).map((repair) => ({
    id: repair.id,
    jobNo: repair.jobNo,
    status: repair.status,
    deviceModel: repair.deviceModel,
    reportedSymptoms: repair.reportedSymptoms,
    technicianNotes: repair.technicianNotes || null,
    estimatedCost: permissions.canViewFinancials ? roundMoney(repair.estimatedCost) : null,
    depositPaid: permissions.canViewFinancials ? roundMoney(repair.depositPaid) : null,
    createdAt: toIsoString(repair.createdAt),
    updatedAt: toIsoString(repair.updatedAt),
    customer: repair.customer
      ? {
          id: repair.customer.id,
          name: repair.customer.name || null,
          companyName: repair.customer.companyName || null,
          phone: repair.customer.user?.loginId || null,
        }
      : null,
    technician: repair.technician
      ? { id: repair.technician.id, name: repair.technician.name || '-' }
      : null,
    partsUsed: (repair.partsUsed || []).map((part) => ({
      id: part.id,
      quantity: part.qtyUsed,
      unitPrice: permissions.canViewFinancials ? roundMoney(part.unitPrice) : null,
      product: part.product
        ? {
            id: part.product.id,
            name: part.product.name,
            brand: part.product.brand?.name || null,
            unit: part.product.unit?.name || null,
          }
        : null,
    })),
  }))

module.exports = {
  buildProductTraceRepairs,
}
