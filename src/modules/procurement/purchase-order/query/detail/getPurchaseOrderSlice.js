const { prisma } = require('../../../../../../lib/prisma');
const { detailInclude, normalizeDetail } = require('../../shared/purchaseOrderShared');

class GetPurchaseOrderRepository {
  constructor(client = prisma) { this.prisma = client; }
  findById(branchId, id) {
    return this.prisma.purchaseOrder.findFirst({
      where: { id: Number(id), branchId: Number(branchId) },
      include: detailInclude,
    });
  }
}

class GetPurchaseOrderService {
  constructor(repository = new GetPurchaseOrderRepository()) { this.repository = repository; }
  async execute(branchId, id) {
    const purchaseOrder = await this.repository.findById(branchId, id);
    return purchaseOrder ? normalizeDetail(purchaseOrder) : null;
  }
}

class GetPurchaseOrderController {
  constructor(service = new GetPurchaseOrderService()) {
    this.service = service;
    this.handle = this.handle.bind(this);
  }
  async handle(req, res) {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ error: 'Invalid ID' });
      const branchId = Number(req.user?.branchId);
      if (!branchId) return res.status(401).json({ error: 'Unauthorized: Missing branchId' });
      const result = await this.service.execute(branchId, id);
      if (!result) return res.status(404).json({ error: 'Purchase Order not found' });
      return res.json(result);
    } catch (error) {
      console.error('❌ getPurchaseOrder error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = new GetPurchaseOrderController();
module.exports.GetPurchaseOrderController = GetPurchaseOrderController;
module.exports.GetPurchaseOrderService = GetPurchaseOrderService;
module.exports.GetPurchaseOrderRepository = GetPurchaseOrderRepository;
