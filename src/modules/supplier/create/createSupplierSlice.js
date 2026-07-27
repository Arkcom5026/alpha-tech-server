const { prisma } = require('../../../../lib/prisma');
const { decimal, toInt } = require('../shared/supplierShared');

class CreateSupplierRepository {
  constructor(client = prisma) { this.prisma = client; }
  create(branchId, input) {
    return this.prisma.supplier.create({
      data: {
        branchId: Number(branchId),
        name: String(input.name).trim(),
        contactPerson: input.contactPerson || null,
        phone: String(input.phone).trim(),
        email: input.email ? String(input.email).trim() : null,
        taxId: input.taxId ? String(input.taxId).trim() : null,
        address: input.address || null,
        province: input.province || null,
        postalCode: input.postalCode || null,
        country: input.country || null,
        paymentTerms: input.paymentTerms || null,
        creditLimit: input.creditLimit !== undefined ? decimal(input.creditLimit) : decimal(0),
        creditBalance: decimal(0),
        isSystem: false,
        active: true,
      },
    });
  }
}

class CreateSupplierService {
  constructor(repository = new CreateSupplierRepository()) { this.repository = repository; }
  execute(branchId, input) { return this.repository.create(branchId, input); }
}

class CreateSupplierController {
  constructor(service = new CreateSupplierService()) { this.service = service; this.handle = this.handle.bind(this); }
  async handle(req, res) {
    try {
      const branchId = toInt(req.user?.branchId);
      if (!branchId) return res.status(400).json({ message: 'branchId is required from token' });
      const { name, phone } = req.body || {};
      if (!name || !phone) return res.status(400).json({ message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (name, phone)' });
      return res.status(201).json(await this.service.execute(branchId, req.body || {}));
    } catch (error) {
      console.error('❌ createSupplier error:', error);
      return res.status(400).json({ message: 'สร้าง supplier ไม่สำเร็จ', error: error?.message || String(error) });
    }
  }
}

module.exports = new CreateSupplierController();
module.exports.CreateSupplierController = CreateSupplierController;
module.exports.CreateSupplierService = CreateSupplierService;
module.exports.CreateSupplierRepository = CreateSupplierRepository;
