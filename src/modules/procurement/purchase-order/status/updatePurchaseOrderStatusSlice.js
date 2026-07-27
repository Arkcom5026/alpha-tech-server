const { prisma } = require('../../../../../lib/prisma');
const { listInclude } = require('../shared/purchaseOrderShared');

class UpdatePurchaseOrderStatusRepository {
  constructor(client = prisma) { this.prisma = client; }
  find(branchId, id) { return this.prisma.purchaseOrder.findFirst({ where: { id: Number(id), branchId: Number(branchId) } }); }
  update(id, status) { return this.prisma.purchaseOrder.update({ where: { id: Number(id) }, data: { status }, include: listInclude }); }
}

class UpdatePurchaseOrderStatusController {
  constructor(repository = new UpdatePurchaseOrderStatusRepository()) { this.repository = repository; this.handle = this.handle.bind(this); }
  async handle(req, res) {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const status = String(req.body?.status || '').trim().toUpperCase();
      if (!id) return res.status(400).json({ error: 'Invalid ID' });
      if (!status) return res.status(400).json({ error: 'INVALID_STATUS' });
      const branchId = Number(req.user?.branchId);
      if (!branchId) return res.status(401).json({ error: 'Unauthorized: Missing branchId' });
      if (!(await this.repository.find(branchId, id))) return res.status(404).json({ error: 'Purchase Order not found' });
      return res.json(await this.repository.update(id, status));
    } catch (error) {
      console.error('❌ updatePurchaseOrderStatus error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = new UpdatePurchaseOrderStatusController();
module.exports.UpdatePurchaseOrderStatusController = UpdatePurchaseOrderStatusController;
module.exports.UpdatePurchaseOrderStatusRepository = UpdatePurchaseOrderStatusRepository;
