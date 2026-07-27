const { prisma } = require('../../../../../../lib/prisma');
const { listInclude } = require('../../shared/purchaseOrderShared');

class ListPurchaseOrdersBySupplierRepository {
  constructor(client = prisma) { this.prisma = client; }
  findMany(branchId, supplierId) {
    return this.prisma.purchaseOrder.findMany({
      where: { branchId: Number(branchId), supplierId: Number(supplierId) },
      include: listInclude,
      orderBy: { createdAt: 'desc' },
    });
  }
}

class ListPurchaseOrdersBySupplierController {
  constructor(repository = new ListPurchaseOrdersBySupplierRepository()) {
    this.repository = repository;
    this.handle = this.handle.bind(this);
  }
  async handle(req, res) {
    try {
      const supplierId = Number(req.params?.supplierId || req.query?.supplierId);
      if (!supplierId) return res.status(400).json({ error: 'Invalid supplierId' });
      const branchId = Number(req.user?.branchId);
      if (!branchId) return res.status(401).json({ error: 'Unauthorized: Missing branchId' });
      return res.json(await this.repository.findMany(branchId, supplierId));
    } catch (error) {
      console.error('❌ listPurchaseOrdersBySupplier error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = new ListPurchaseOrdersBySupplierController();
module.exports.ListPurchaseOrdersBySupplierRepository = ListPurchaseOrdersBySupplierRepository;
