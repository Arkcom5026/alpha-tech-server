'use strict';

const { prisma } = require('../../../../../lib/prisma');
const {
  asOptionalText,
  asRequiredText,
  branchIdFromToken,
  employeeIdFromToken,
  sendError,
} = require('../../shared/taxExpenseContext');

const PAYEE_TYPES = new Set(['INDIVIDUAL', 'LEGAL_ENTITY', 'GOVERNMENT', 'OTHER']);

const asPayeeType = (value) => {
  const normalized = String(value || 'LEGAL_ENTITY').trim().toUpperCase();
  if (!PAYEE_TYPES.has(normalized)) {
    const error = new Error('payeeType ไม่ถูกต้อง');
    error.statusCode = 400;
    error.code = 'TAX_EXPENSE_PAYEE_TYPE_INVALID';
    throw error;
  }
  return normalized;
};

const asLimitedOptionalText = (value, field, maxLength) => {
  const normalized = asOptionalText(value);
  if (normalized && normalized.length > maxLength) {
    const error = new Error(`${field} ต้องมีความยาวไม่เกิน ${maxLength} ตัวอักษร`);
    error.statusCode = 400;
    error.code = 'TAX_EXPENSE_PAYEE_VALIDATION_ERROR';
    throw error;
  }
  return normalized;
};

class CreateExpensePayeeRepository {
  constructor(client = prisma) { this.prisma = client; }

  create({ branchId, employeeId, input }) {
    return this.prisma.expensePayee.create({
      data: {
        branchId,
        payeeType: input.payeeType,
        name: input.name,
        taxId: input.taxId,
        taxBranchCode: input.taxBranchCode,
        address: input.address,
        phone: input.phone,
        email: input.email,
        contactPerson: input.contactPerson,
        notes: input.notes,
        active: true,
        createdByEmployeeId: employeeId,
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
    });
  }
}

class CreateExpensePayeeController {
  constructor(repository = new CreateExpensePayeeRepository()) {
    this.repository = repository;
    this.handle = this.handle.bind(this);
  }

  async handle(req, res) {
    try {
      const taxId = asLimitedOptionalText(req.body?.taxId, 'taxId', 13);
      const taxBranchCode = asLimitedOptionalText(req.body?.taxBranchCode, 'taxBranchCode', 5) || '00000';
      const data = await this.repository.create({
        branchId: branchIdFromToken(req),
        employeeId: employeeIdFromToken(req),
        input: {
          payeeType: asPayeeType(req.body?.payeeType),
          name: asRequiredText(req.body?.name, 'name'),
          taxId,
          taxBranchCode,
          address: asOptionalText(req.body?.address),
          phone: asOptionalText(req.body?.phone),
          email: asOptionalText(req.body?.email),
          contactPerson: asOptionalText(req.body?.contactPerson),
          notes: asOptionalText(req.body?.notes),
        },
      });
      return res.status(201).json({ ok: true, data });
    } catch (error) {
      return sendError(res, error, 'ไม่สามารถสร้างข้อมูลผู้รับเงินค่าใช้จ่ายได้');
    }
  }
}

module.exports = new CreateExpensePayeeController();
module.exports.CreateExpensePayeeRepository = CreateExpensePayeeRepository;
module.exports.CreateExpensePayeeController = CreateExpensePayeeController;
module.exports.asPayeeType = asPayeeType;
