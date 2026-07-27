const { prisma } = require('../../../../lib/prisma');
const { toInt } = require('../shared/supplierShared');

class DeleteSupplierRepository {
  constructor(client = prisma) { this.prisma = client; }
  findById(branchId, supplierId) {
    return this.prisma.supplier.findFirst({ where: { id: Number(supplierId), branchId: Number(branchId) } });
  }
  countPurchaseOrders(supplierId) {
    return this.prisma.purchaseOrder.count({ where: { supplierId: Number(supplierId) } });
  }
  delete(supplierId) {
    return this.prisma.supplier.delete({ where: { id: Number(supplierId) } });
  }
}

class DeleteSupplierService {
  constructor(repository = new DeleteSupplierRepository()) { this.repository = repository; }
  async execute(branchId, supplierId) {
    const existing = await this.repository.findById(branchId, supplierId);
    if (!existing) return { failure: 'NOT_FOUND' };
    if (existing.isSystem) return { failure: 'SYSTEM_SUPPLIER' };
    if ((await this.repository.countPurchaseOrders(supplierId)) > 0) return { failure: 'REFERENCED' };
    await this.repository.delete(supplierId);
    return { deleted: true };
  }
}

class DeleteSupplierController {
  constructor(service = new DeleteSupplierService()) { this.service = service; this.handle = this.handle.bind(this); }
  async handle(req, res) {
    try {
      const branchId = toInt(req.user?.branchId);
      const supplierId = toInt(req.params.id);
      if (!branchId) return res.status(400).json({ error: 'branchId is required from token' });
      if (!supplierId) return res.status(400).json({ error: 'supplierId ไม่ถูกต้อง' });

      const result = await this.service.execute(branchId, supplierId);
      if (result.failure === 'NOT_FOUND') return res.status(403).json({ message: 'ไม่พบ supplier หรือไม่มีสิทธิ์ลบ' });
      if (result.failure === 'SYSTEM_SUPPLIER') return res.status(403).json({ message: 'ไม่สามารถลบ Supplier ระบบได้' });
      if (result.failure === 'REFERENCED') return res.status(409).json({ message: 'ลบไม่ได้: มีเอกสารจัดซื้ออ้างอิงอยู่' });
      return res.status(204).end();
    } catch (error) {
      console.error('❌ deleteSupplier error:', error);
      return res.status(400).json({ message: 'ลบ supplier ไม่สำเร็จ', error: error?.message || String(error) });
    }
  }
}

module.exports = new DeleteSupplierController();
module.exports.DeleteSupplierController = DeleteSupplierController;
module.exports.DeleteSupplierService = DeleteSupplierService;
module.exports.DeleteSupplierRepository = DeleteSupplierRepository;
