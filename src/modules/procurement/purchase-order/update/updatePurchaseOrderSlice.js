const { prisma } = require('../../../../../lib/prisma');
const { decimal } = require('../shared/purchaseOrderShared');

class UpdatePurchaseOrderRepository {
  constructor(client = prisma) { this.prisma = client; }
  find(branchId, id) { return this.prisma.purchaseOrder.findFirst({ where: { id: Number(id), branchId: Number(branchId) } }); }
  transaction(work) { return this.prisma.$transaction((tx) => work(new UpdatePurchaseOrderRepository(tx))); }
  update(id, data) { return this.prisma.purchaseOrder.update({ where: { id: Number(id) }, data }); }
  deleteItems(id) { return this.prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: Number(id) } }); }
  replaceItems(id, items) { return this.prisma.purchaseOrder.update({ where: { id: Number(id) }, data: { items: { create: items.map((item) => ({ productId: Number(item.productId), quantity: Number(item.quantity), costPrice: decimal(item.costPrice) })) } } }); }
  upsertBranchPrice(branchId, item) { return this.prisma.branchPrice.upsert({ where: { productId_branchId: { productId: Number(item.productId), branchId: Number(branchId) } }, update: { costPrice: decimal(item.costPrice) }, create: { productId: Number(item.productId), branchId: Number(branchId), costPrice: decimal(item.costPrice), isActive: true } }); }
}

class UpdatePurchaseOrderController {
  constructor(repository = new UpdatePurchaseOrderRepository()) { this.repository = repository; this.handle = this.handle.bind(this); }
  async handle(req, res) {
    try {
      const id = Number.parseInt(req.params.id, 10);
      const branchId = Number(req.user?.branchId);
      if (!id) return res.status(400).json({ error: 'Invalid ID' });
      if (!branchId) return res.status(401).json({ error: 'Unauthorized: Missing branchId' });
      if (!(await this.repository.find(branchId, id))) return res.status(404).json({ error: 'ไม่พบใบสั่งซื้อในสาขานี้' });
      const { note, status, items } = req.body;
      await this.repository.transaction(async (tx) => {
        await tx.update(id, { note: note || null, status: status || undefined });
        if (Array.isArray(items)) {
          await tx.deleteItems(id);
          await tx.replaceItems(id, items);
          for (const item of items) await tx.upsertBranchPrice(branchId, item);
        }
      });
      return res.json({ success: true });
    } catch (error) {
      console.error('❌ updatePurchaseOrder error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = new UpdatePurchaseOrderController();
module.exports.UpdatePurchaseOrderController = UpdatePurchaseOrderController;
module.exports.UpdatePurchaseOrderRepository = UpdatePurchaseOrderRepository;
