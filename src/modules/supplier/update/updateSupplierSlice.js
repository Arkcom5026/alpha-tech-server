const { prisma } = require('../../../../lib/prisma');
const { decimal, toInt } = require('../shared/supplierShared');

const allowedFields = [
  'name', 'contactPerson', 'phone', 'email', 'taxId', 'address', 'province',
  'postalCode', 'country', 'paymentTerms', 'creditLimit', 'bankId',
  'accountNumber', 'accountType', 'notes', 'active',
];

class UpdateSupplierRepository {
  constructor(client = prisma) { this.prisma = client; }
  findById(branchId, supplierId) {
    return this.prisma.supplier.findFirst({ where: { id: Number(supplierId), branchId: Number(branchId) } });
  }
  update(supplierId, data) {
    return this.prisma.supplier.update({ where: { id: Number(supplierId) }, data });
  }
}

class UpdateSupplierService {
  constructor(repository = new UpdateSupplierRepository()) { this.repository = repository; }
  async execute(branchId, supplierId, input = {}) {
    const existing = await this.repository.findById(branchId, supplierId);
    if (!existing) return { failure: 'NOT_FOUND' };
    if (existing.isSystem) return { failure: 'SYSTEM_SUPPLIER' };

    const data = {};
    for (const field of allowedFields) {
      if (field in input) data[field] = input[field];
    }
    if (data.creditLimit !== undefined) data.creditLimit = decimal(data.creditLimit);
    if (data.bankId !== undefined && data.bankId !== null) data.bankId = toInt(data.bankId);
    return { supplier: await this.repository.update(supplierId, data) };
  }
}

class UpdateSupplierController {
  constructor(service = new UpdateSupplierService()) { this.service = service; this.handle = this.handle.bind(this); }
  async handle(req, res) {
    try {
      const branchId = toInt(req.user?.branchId);
      const supplierId = toInt(req.params.id);
      if (!branchId || !supplierId) return res.status(400).json({ message: 'branchId หรือ supplierId ไม่ถูกต้อง' });

      const result = await this.service.execute(branchId, supplierId, req.body || {});
      if (result.failure === 'NOT_FOUND') return res.status(403).json({ message: 'ไม่พบ supplier หรือไม่มีสิทธิ์เข้าถึง' });
      if (result.failure === 'SYSTEM_SUPPLIER') return res.status(403).json({ message: 'ไม่สามารถแก้ไข Supplier ระบบได้' });
      return res.json(result.supplier);
    } catch (error) {
      console.error('❌ updateSupplier error:', error);
      return res.status(400).json({ message: 'แก้ไข supplier ล้มเหลว', error: error?.message || String(error) });
    }
  }
}

module.exports = new UpdateSupplierController();
module.exports.UpdateSupplierController = UpdateSupplierController;
module.exports.UpdateSupplierService = UpdateSupplierService;
module.exports.UpdateSupplierRepository = UpdateSupplierRepository;
