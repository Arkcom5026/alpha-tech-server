const { prisma } = require('../../../../../lib/prisma');

class DeletePurchaseOrderRepository {
  constructor(client = prisma) { this.prisma = client; }
  find(branchId, id) { return this.prisma.purchaseOrder.findFirst({ where: { id: Number(id), branchId: Number(branchId) } }); }
  delete(id) { return this.prisma.purchaseOrder.delete({ where: { id: Number(id) } }); }
}

class DeletePurchaseOrderController {
  constructor(repository = new DeletePurchaseOrderRepository()) { this.repository = repository; this.handle = this.handle.bind(this); }
  async handle(req, res) {
    try {
      const id = Number(req.params.id);
      const branchId = Number(req.user?.branchId);
      if (!id || !branchId) return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน' });
      if (!(await this.repository.find(branchId, id))) return res.status(404).json({ error: 'ไม่พบใบสั่งซื้อนี้ในสาขาของคุณ' });
      await this.repository.delete(id);
      return res.json({ success: true });
    } catch (error) {
      console.error('❌ deletePurchaseOrder error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = new DeletePurchaseOrderController();
module.exports.DeletePurchaseOrderController = DeletePurchaseOrderController;
module.exports.DeletePurchaseOrderRepository = DeletePurchaseOrderRepository;
