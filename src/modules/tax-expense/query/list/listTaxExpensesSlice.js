'use strict';

const { prisma } = require('../../../../../lib/prisma');
const { branchIdFromToken, sendError } = require('../../shared/taxExpenseContext');

const validDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());

class ListTaxExpensesRepository {
  constructor(client = prisma) { this.prisma = client; }
  findMany(branchId, query) {
    const q = String(query?.q || '').trim();
    const status = String(query?.status || '').trim().toUpperCase();
    const fromDate = query?.fromDate ? new Date(query.fromDate) : null;
    const toDate = query?.toDate ? new Date(query.toDate) : null;
    const expenseDate = {
      ...(validDate(fromDate) ? { gte: fromDate } : {}),
      ...(validDate(toDate) ? { lte: toDate } : {}),
    };

    return this.prisma.taxExpense.findMany({
      where: {
        branchId,
        ...(status ? { status } : {}),
        ...(q ? { OR: [
          { expenseNumber: { contains: q, mode: 'insensitive' } },
          { documentNumber: { contains: q, mode: 'insensitive' } },
          { counterpartyName: { contains: q, mode: 'insensitive' } },
        ] } : {}),
        ...(Object.keys(expenseDate).length ? { expenseDate } : {}),
      },
      select: {
        id: true, expenseNumber: true, documentNumber: true, expenseDate: true,
        status: true, evidenceStatus: true, subtotalAmount: true, vatAmount: true,
        totalAmount: true, paymentDueAmount: true, counterpartyName: true,
        supplier: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: [{ expenseDate: 'desc' }, { id: 'desc' }],
      take: 100,
    });
  }
}

class ListTaxExpensesController {
  constructor(repository = new ListTaxExpensesRepository()) { this.repository = repository; this.handle = this.handle.bind(this); }
  async handle(req, res) {
    try {
      return res.json({ ok: true, data: await this.repository.findMany(branchIdFromToken(req), req.query) });
    } catch (error) {
      return sendError(res, error, 'ไม่สามารถโหลดรายการค่าใช้จ่ายได้');
    }
  }
}

module.exports = new ListTaxExpensesController();
module.exports.ListTaxExpensesRepository = ListTaxExpensesRepository;
module.exports.ListTaxExpensesController = ListTaxExpensesController;
