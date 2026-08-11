'use strict';

const { prisma } = require('../../../../lib/prisma');
const {
  asMoney,
  asOptionalDate,
  asOptionalText,
  asPositiveInt,
  asRequiredDate,
  asRequiredText,
  branchIdFromToken,
  employeeIdFromToken,
  sendError,
} = require('../shared/taxExpenseContext');

const buildExpenseNumber = async (tx, branchId, expenseDate) => {
  const date = new Date(expenseDate);
  const prefix = `TE-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-`;
  const count = await tx.taxExpense.count({ where: { branchId, expenseNumber: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
};

const normalizeItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error('ต้องมีรายการค่าใช้จ่ายอย่างน้อยหนึ่งรายการ');
    error.statusCode = 400;
    error.code = 'TAX_EXPENSE_ITEMS_REQUIRED';
    throw error;
  }

  return items.map((raw, index) => {
    const quantity = Number(raw?.quantity ?? 1);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      const error = new Error(`items[${index}].quantity ต้องมากกว่า 0`);
      error.statusCode = 400;
      error.code = 'TAX_EXPENSE_VALIDATION_ERROR';
      throw error;
    }
    const unitAmount = Number(asMoney(raw?.unitAmount, `items[${index}].unitAmount`));
    const vatAmount = Number(asMoney(raw?.vatAmount ?? 0, `items[${index}].vatAmount`));
    const withholdingTaxAmount = Number(asMoney(raw?.withholdingTaxAmount ?? 0, `items[${index}].withholdingTaxAmount`));
    return {
      categoryId: asPositiveInt(raw?.categoryId),
      lineNumber: index + 1,
      description: asRequiredText(raw?.description, `items[${index}].description`),
      quantity: quantity.toFixed(2),
      unitAmount: unitAmount.toFixed(2),
      subtotalAmount: (quantity * unitAmount).toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      withholdingTaxAmount: withholdingTaxAmount.toFixed(2),
      vatTreatment: 'PENDING_REVIEW',
      citTreatment: 'PENDING_REVIEW',
      whtTreatment: withholdingTaxAmount > 0 ? 'PENDING_REVIEW' : 'NOT_APPLICABLE',
      withholdingTaxRate: raw?.withholdingTaxRate == null ? null : asMoney(raw.withholdingTaxRate, `items[${index}].withholdingTaxRate`),
    };
  }).map((item) => {
    if (!item.categoryId) {
      const error = new Error('categoryId ของรายการค่าใช้จ่ายไม่ถูกต้อง');
      error.statusCode = 400;
      error.code = 'TAX_EXPENSE_VALIDATION_ERROR';
      throw error;
    }
    return item;
  });
};

const toNestedItemCreate = (item, branchId) => {
  const { categoryId, ...data } = item;
  return {
    ...data,
    category: {
      connect: {
        id_branchId: { id: categoryId, branchId },
      },
    },
  };
};

class CreateTaxExpenseService {
  constructor(client = prisma) { this.prisma = client; }

  async execute({ branchId, employeeId, input }) {
    const expensePayeeId = asPositiveInt(input?.expensePayeeId);
    const repairJobId = asPositiveInt(input?.repairJobId);
    const repairSubcontractId = asPositiveInt(input?.repairSubcontractId);
    if (Boolean(repairJobId) !== Boolean(repairSubcontractId)) {
      const error = new Error('ต้องระบุทั้ง Repair Job และรายการส่งซ่อมภายนอกเป็นเหตุผลการจ่าย');
      error.statusCode = 400;
      error.code = 'TAX_EXPENSE_REPAIR_REASON_INCOMPLETE';
      throw error;
    }
    if (!expensePayeeId) {
      const error = new Error('ต้องระบุผู้รับเงินค่าใช้จ่าย');
      error.statusCode = 400;
      error.code = 'TAX_EXPENSE_PAYEE_REQUIRED';
      throw error;
    }
    const documentNumber = asRequiredText(input?.documentNumber, 'documentNumber');
    const expenseDate = input?.expenseDate
      ? asRequiredDate(input.expenseDate, 'expenseDate')
      : new Date();
    const documentDate = asOptionalDate(input?.documentDate, 'documentDate') || expenseDate;
    const receivedAt = asOptionalDate(input?.receivedAt, 'receivedAt') || new Date();
    const items = normalizeItems(input?.items);

    return this.prisma.$transaction(async (tx) => {
      const expensePayee = await tx.expensePayee.findFirst({
        where: { id: expensePayeeId, branchId, active: true },
        select: { id: true, name: true, taxId: true },
      });
      if (!expensePayee) {
        const error = new Error('ไม่พบผู้รับเงินค่าใช้จ่ายที่ใช้งานได้สำหรับร้านนี้');
        error.statusCode = 404;
        error.code = 'TAX_EXPENSE_PAYEE_NOT_FOUND';
        throw error;
      }

      if (repairSubcontractId) {
        const reason = await tx.repairSubcontract.findFirst({
          where: { id: repairSubcontractId, repairJobId, branchId, expensePayeeId },
          select: { id: true, repairJobId: true },
        });
        if (!reason) {
          const error = new Error('รายการส่งซ่อมไม่ตรงกับใบงาน สาขา หรือผู้รับเงินที่เลือก');
          error.statusCode = 400;
          error.code = 'TAX_EXPENSE_REPAIR_REASON_MISMATCH';
          throw error;
        }
      }

      const categories = await tx.taxExpenseCategory.findMany({
        where: { branchId, active: true, id: { in: items.map((item) => item.categoryId) } },
        select: { id: true },
      });
      if (categories.length !== new Set(items.map((item) => item.categoryId)).size) {
        const error = new Error('พบหมวดค่าใช้จ่ายที่ไม่อยู่ในร้านนี้หรือถูกปิดใช้งาน');
        error.statusCode = 400;
        error.code = 'TAX_EXPENSE_CATEGORY_INVALID';
        throw error;
      }

      const subtotalAmount = items.reduce((sum, item) => sum + Number(item.subtotalAmount), 0);
      const vatAmount = items.reduce((sum, item) => sum + Number(item.vatAmount), 0);
      const withholdingTaxAmount = items.reduce((sum, item) => sum + Number(item.withholdingTaxAmount), 0);
      const totalAmount = subtotalAmount + vatAmount;
      if (withholdingTaxAmount > totalAmount) {
        const error = new Error('ภาษีหัก ณ ที่จ่ายต้องไม่เกินยอดรวมค่าใช้จ่าย');
        error.statusCode = 400;
        error.code = 'TAX_EXPENSE_WITHHOLDING_EXCEEDS_TOTAL';
        throw error;
      }
      const paymentDueAmount = totalAmount - withholdingTaxAmount;
      const expenseNumber = await buildExpenseNumber(tx, branchId, expenseDate);

      return tx.taxExpense.create({
        data: {
          branchId,
          expensePayeeId: expensePayee.id,
          repairJobId: repairJobId || null,
          repairSubcontractId: repairSubcontractId || null,
          supplierId: null,
          expenseNumber,
          counterpartyType: 'EXPENSE_PAYEE',
          counterpartyName: expensePayee.name,
          counterpartyTaxId: expensePayee.taxId,
          documentNumber,
          documentDate,
          expenseDate,
          receivedAt,
          status: 'RECORDED',
          evidenceStatus: 'PENDING_REVIEW',
          currency: 'THB',
          subtotalAmount: subtotalAmount.toFixed(2),
          vatAmount: vatAmount.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          withholdingTaxAmount: withholdingTaxAmount.toFixed(2),
          paymentDueAmount: paymentDueAmount.toFixed(2),
          note: asOptionalText(input?.note),
          createdByEmployeeId: employeeId,
          items: { create: items.map((item) => toNestedItemCreate(item, branchId)) },
          lifecycleEvents: {
            create: {
              eventType: 'RECORDED',
              previousStatus: 'DRAFT',
              resultingStatus: 'RECORDED',
              actorEmployeeId: employeeId,
              metadata: { source: 'tax-expense-runtime', payeeAuthority: 'ExpensePayee', repairJobId: repairJobId || null, repairSubcontractId: repairSubcontractId || null },
            },
          },
        },
        include: {
          expensePayee: { select: { id: true, name: true, taxId: true } },
          items: { include: { category: { select: { id: true, code: true, name: true } } }, orderBy: { lineNumber: 'asc' } },
        },
      });
    });
  }
}

class CreateTaxExpenseController {
  constructor(service = new CreateTaxExpenseService()) { this.service = service; this.handle = this.handle.bind(this); }
  async handle(req, res) {
    try {
      const data = await this.service.execute({
        branchId: branchIdFromToken(req),
        employeeId: employeeIdFromToken(req),
        input: req.body || {},
      });
      return res.status(201).json({ ok: true, data });
    } catch (error) {
      return sendError(res, error, 'ไม่สามารถบันทึกค่าใช้จ่ายได้');
    }
  }
}

module.exports = new CreateTaxExpenseController();
module.exports.CreateTaxExpenseService = CreateTaxExpenseService;
module.exports.CreateTaxExpenseController = CreateTaxExpenseController;
module.exports.toNestedItemCreate = toNestedItemCreate;
