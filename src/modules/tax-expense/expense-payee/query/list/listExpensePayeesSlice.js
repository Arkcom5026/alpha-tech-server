'use strict';

const { prisma } = require('../../../../../../lib/prisma');
const {
  branchIdFromToken,
  sendError,
} = require('../../../shared/taxExpenseContext');

class ListExpensePayeesRepository {
  constructor(client = prisma) { this.prisma = client; }

  findMany(branchId, q) {
    return this.prisma.expensePayee.findMany({
      where: {
        branchId,
        active: true,
        ...(q ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { taxId: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
            { contactPerson: { contains: q, mode: 'insensitive' } },
          ],
        } : {}),
      },
      select: {
        id: true,
        payeeType: true,
        name: true,
        taxId: true,
        taxBranchCode: true,
        address: true,
        phone: true,
        email: true,
        contactPerson: true,
        notes: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }
}

class ListExpensePayeesController {
  constructor(repository = new ListExpensePayeesRepository()) {
    this.repository = repository;
    this.handle = this.handle.bind(this);
  }

  async handle(req, res) {
    try {
      const q = String(req.query?.q || '').trim();
      const data = await this.repository.findMany(branchIdFromToken(req), q);
      return res.json({ ok: true, data });
    } catch (error) {
      return sendError(res, error, 'ไม่สามารถโหลดข้อมูลผู้รับเงินค่าใช้จ่ายได้');
    }
  }
}

module.exports = new ListExpensePayeesController();
module.exports.ListExpensePayeesRepository = ListExpensePayeesRepository;
module.exports.ListExpensePayeesController = ListExpensePayeesController;
