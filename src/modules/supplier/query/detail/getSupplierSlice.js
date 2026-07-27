const { prisma } = require('../../../../../lib/prisma');
const { mapSupplierCredit, toInt } = require('../../shared/supplierShared');

class GetSupplierRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  findById(branchId, supplierId) {
    return this.prisma.supplier.findFirst({
      where: { id: Number(supplierId), branchId: Number(branchId) },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        contactPerson: true,
        taxId: true,
        address: true,
        province: true,
        postalCode: true,
        country: true,
        paymentTerms: true,
        creditLimit: true,
        creditBalance: true,
        bankId: true,
        accountNumber: true,
        accountType: true,
        notes: true,
        active: true,
        isSystem: true,
        createdAt: true,
      },
    });
  }
}

class GetSupplierService {
  constructor(repository = new GetSupplierRepository()) {
    this.repository = repository;
  }

  async execute(branchId, supplierId) {
    const supplier = await this.repository.findById(branchId, supplierId);
    return supplier ? mapSupplierCredit(supplier) : null;
  }
}

class GetSupplierController {
  constructor(service = new GetSupplierService()) {
    this.service = service;
    this.handle = this.handle.bind(this);
  }

  async handle(req, res) {
    try {
      const branchId = toInt(req.user?.branchId);
      const supplierId = toInt(req.params.id);
      if (!branchId || !supplierId) {
        return res.status(400).json({ error: 'branchId หรือ supplierId ไม่ถูกต้อง' });
      }

      const supplier = await this.service.execute(branchId, supplierId);
      if (!supplier) return res.status(404).json({ error: 'ไม่พบ Supplier' });
      return res.json(supplier);
    } catch (error) {
      console.error('❌ [getSupplierById] error:', error);
      return res.status(500).json({ error: 'โหลดข้อมูล supplier ล้มเหลว' });
    }
  }
}

module.exports = new GetSupplierController();
module.exports.GetSupplierController = GetSupplierController;
module.exports.GetSupplierService = GetSupplierService;
module.exports.GetSupplierRepository = GetSupplierRepository;
