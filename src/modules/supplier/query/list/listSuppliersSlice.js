const { prisma } = require('../../../../../lib/prisma');
const {
  decimal,
  mapSupplierCredit,
  omitUndefined,
  toInt,
  toNum,
} = require('../../shared/supplierShared');

class ListSuppliersRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  findMany(branchId, query = {}) {
    const includeSystem = String(query.includeSystem || '0') === '1';
    const q = String(query.q || '').trim();
    const where = omitUndefined({
      branchId: Number(branchId),
      ...(includeSystem ? {} : { isSystem: false }),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { contactPerson: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    });

    return this.prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        contactPerson: true,
        creditLimit: true,
        creditBalance: true,
        isSystem: true,
        active: true,
        createdAt: true,
      },
    });
  }
}

class ListSuppliersService {
  constructor(repository = new ListSuppliersRepository()) {
    this.repository = repository;
  }

  async execute(branchId, query) {
    const suppliers = await this.repository.findMany(branchId, query);
    return suppliers.map((supplier) => {
      const mapped = mapSupplierCredit(supplier);
      return {
        ...mapped,
        creditRemaining: toNum(decimal(supplier.creditLimit).minus(decimal(supplier.creditBalance))),
      };
    });
  }
}

class ListSuppliersController {
  constructor(service = new ListSuppliersService()) {
    this.service = service;
    this.handle = this.handle.bind(this);
  }

  async handle(req, res) {
    try {
      const branchId = toInt(req.user?.branchId);
      if (!branchId) {
        return res.status(400).json({ error: 'branchId is required from token' });
      }
      return res.json(await this.service.execute(branchId, req.query));
    } catch (error) {
      console.error('❌ getAllSuppliers error:', error);
      return res.status(500).json({ error: 'Server error while fetching suppliers' });
    }
  }
}

module.exports = new ListSuppliersController();
module.exports.ListSuppliersController = ListSuppliersController;
module.exports.ListSuppliersService = ListSuppliersService;
module.exports.ListSuppliersRepository = ListSuppliersRepository;
