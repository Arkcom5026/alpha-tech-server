'use strict';

const { prisma } = require('../../../../../lib/prisma');
const { branchIdFromToken, sendError } = require('../../shared/taxExpenseContext');

class ListExpensePayeeSuppliersRepository {
  constructor(client = prisma) { this.prisma = client; }
  findMany(branchId, q) {
    return this.prisma.supplier.findMany({
      where: {
        branchId,
        active: true,
        capabilities: { some: { capability: 'EXPENSE_PAYEE' } },
        ...(q ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { taxId: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
          ],
        } : {}),
      },
      select: { id: true, name: true, taxId: true, phone: true, contactPerson: true },
      orderBy: { name: 'asc' },
    });
  }
}

class ListExpensePayeeSuppliersController {
  constructor(repository = new ListExpensePayeeSuppliersRepository()) {
    this.repository = repository;
    this.handle = this.handle.bind(this);
  }

  async handle(req, res) {
    try {
      const q = String(req.query?.q || '').trim();
      return res.json({ ok: true, data: await this.repository.findMany(branchIdFromToken(req), q) });
    } catch (error) {
      return sendError(res, error, 'ไม่สามารถโหลดผู้รับเงินค่าใช้จ่ายได้');
    }
  }
}

module.exports = new ListExpensePayeeSuppliersController();
module.exports.ListExpensePayeeSuppliersRepository = ListExpensePayeeSuppliersRepository;
module.exports.ListExpensePayeeSuppliersController = ListExpensePayeeSuppliersController;
