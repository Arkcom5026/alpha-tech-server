'use strict';

const { prisma } = require('../../../../../lib/prisma');
const {
  asRequiredText,
  branchIdFromToken,
  sendError,
} = require('../../shared/taxExpenseContext');

class CreateTaxExpenseCategoryRepository {
  constructor(client = prisma) { this.prisma = client; }
  create(branchId, input) {
    return this.prisma.taxExpenseCategory.create({
      data: { branchId, code: input.code, name: input.name, active: true },
      select: { id: true, code: true, name: true, active: true },
    });
  }
}

class CreateTaxExpenseCategoryController {
  constructor(repository = new CreateTaxExpenseCategoryRepository()) {
    this.repository = repository;
    this.handle = this.handle.bind(this);
  }

  async handle(req, res) {
    try {
      const category = await this.repository.create(branchIdFromToken(req), {
        code: asRequiredText(req.body?.code, 'code').toUpperCase(),
        name: asRequiredText(req.body?.name, 'name'),
      });
      return res.status(201).json({ ok: true, data: category });
    } catch (error) {
      if (error?.code === 'P2002') {
        error.statusCode = 409;
        error.code = 'TAX_EXPENSE_CATEGORY_CODE_EXISTS';
        error.message = 'รหัสหมวดค่าใช้จ่ายนี้มีอยู่แล้วในร้าน';
      }
      return sendError(res, error, 'ไม่สามารถสร้างหมวดค่าใช้จ่ายได้');
    }
  }
}

module.exports = new CreateTaxExpenseCategoryController();
module.exports.CreateTaxExpenseCategoryRepository = CreateTaxExpenseCategoryRepository;
module.exports.CreateTaxExpenseCategoryController = CreateTaxExpenseCategoryController;
