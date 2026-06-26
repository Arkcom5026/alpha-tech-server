const prisma = require('../../../database/prisma/client');

class ProcurementRepository {
  async findSupplierById(branchId, supplierId) {
    return await prisma.supplierProfile.findFirst({
      where: { id: supplierId, branchId }
    });
  }

  async findPurchaseOrderWithDetails(branchId, poId) {
    return await prisma.purchaseOrder.findFirst({
      where: { id: poId, branchId },
      include: {
        supplier: true,
        items: {
          include: { product: true }
        }
      }
    });
  }
}

module.exports = new ProcurementRepository();