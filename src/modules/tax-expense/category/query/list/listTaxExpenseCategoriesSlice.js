'use strict';

const { prisma } = require('../../../../../../lib/prisma');
const { branchIdFromToken, sendError } = require('../../../shared/taxExpenseContext');

class ListTaxExpenseCategoriesRepository {
  constructor(client = prisma) { this.prisma = client; }
  findMany(branchId) {
    return this.prisma.taxExpenseCategory.findMany({
      where: { branchId, active: true },
      select: { id: true, code: true, name: true, active: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }
}

class ListTaxExpenseCategoriesController {
  constructor(repository = new ListTaxExpenseCategoriesRepository()) {
    this.repository = repository;
    this.handle = this.handle.bind(this);
  }

  async handle(req, res) {
    try {
      return res.json({ ok: true, data: await this.repository.findMany(branchIdFromToken(req)) });
    } catch (error) {
      return sendError(res, error, 'ไม่สามารถโหลดหมวดค่าใช้จ่ายได้');
    }
  }
}

module.exports = new ListTaxExpenseCategoriesController();
module.exports.ListTaxExpenseCategoriesRepository = ListTaxExpenseCategoriesRepository;
module.exports.ListTaxExpenseCategoriesController = ListTaxExpenseCategoriesController;
