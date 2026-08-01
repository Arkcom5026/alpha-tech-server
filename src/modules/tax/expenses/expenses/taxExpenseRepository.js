'use strict';

const crypto = require('crypto');
const { prisma } = require('../../../../lib/prisma');

const expenseInclude = Object.freeze({
  supplier: { select: { id: true, name: true } },
  createdByEmployee: { select: { id: true, firstName: true, lastName: true } },
  items: { include: { category: { select: { id: true, code: true, name: true } } }, orderBy: { lineNumber: 'asc' } },
  lifecycleEvents: { orderBy: { occurredAt: 'asc' } },
});

const createExpenseNumber = (expenseDate) => {
  const stamp = expenseDate.toISOString().slice(0, 10).replaceAll('-', '');
  return `EXP-${stamp}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
};

const create = async ({ branchId, employeeId, expense }) => prisma.$transaction(async (tx) => {
  const categoryIds = [...new Set(expense.items.map((item) => item.categoryId))];
  const categories = await tx.taxExpenseCategory.findMany({
    where: { branchId: Number(branchId), id: { in: categoryIds }, active: true },
    select: { id: true },
  });
  if (categories.length !== categoryIds.length) {
    const error = new Error('Every expense category must be active and belong to this branch');
    error.code = 'TAX_EXPENSE_CATEGORY_FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }

  if (expense.supplierId) {
    const supplier = await tx.supplier.findFirst({
      where: { id: expense.supplierId, branchId: Number(branchId) },
      select: { id: true },
    });
    if (!supplier) {
      const error = new Error('Supplier does not belong to this branch');
      error.code = 'TAX_EXPENSE_SUPPLIER_FORBIDDEN';
      error.statusCode = 403;
      throw error;
    }
  }

  return tx.taxExpense.create({
    data: {
      branchId: Number(branchId),
      supplierId: expense.supplierId,
      expenseNumber: createExpenseNumber(expense.expenseDate),
      counterpartyType: expense.counterpartyType,
      counterpartyName: expense.counterpartyName,
      counterpartyTaxId: expense.counterpartyTaxId,
      documentNumber: expense.documentNumber,
      documentDate: expense.documentDate,
      expenseDate: expense.expenseDate,
      receivedAt: expense.receivedAt,
      subtotalAmount: expense.subtotalAmount,
      vatAmount: expense.vatAmount,
      totalAmount: expense.totalAmount,
      withholdingTaxAmount: expense.withholdingTaxAmount,
      paymentDueAmount: expense.paymentDueAmount,
      note: expense.note,
      createdByEmployeeId: Number(employeeId),
      items: {
        create: expense.items.map((item) => ({
          categoryId: item.categoryId,
          lineNumber: item.lineNumber,
          description: item.description,
          quantity: item.quantity,
          unitAmount: item.unitAmount,
          subtotalAmount: item.subtotalAmount,
          vatAmount: item.vatAmount,
          withholdingTaxRate: item.withholdingTaxRate,
          withholdingTaxAmount: item.withholdingTaxAmount,
        })),
      },
      lifecycleEvents: {
        create: {
          eventType: 'CREATED',
          resultingStatus: 'DRAFT',
          actorEmployeeId: Number(employeeId),
          metadata: { source: 'TAX_EXPENSE_OPERATIONAL_SLICE_1' },
        },
      },
    },
    include: expenseInclude,
  });
});

const list = ({ branchId, filters }) => prisma.taxExpense.findMany({
  where: {
    branchId: Number(branchId),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
    ...(filters.documentNumber ? { documentNumber: { contains: filters.documentNumber, mode: 'insensitive' } } : {}),
    ...(filters.fromDate || filters.toDate ? { expenseDate: { ...(filters.fromDate ? { gte: filters.fromDate } : {}), ...(filters.toDate ? { lte: filters.toDate } : {}) } } : {}),
  },
  include: {
    supplier: { select: { id: true, name: true } },
    _count: { select: { items: true, attachments: true } },
  },
  orderBy: [{ expenseDate: 'desc' }, { id: 'desc' }],
});

const findById = ({ branchId, taxExpenseId }) => prisma.taxExpense.findFirst({
  where: { id: Number(taxExpenseId), branchId: Number(branchId) },
  include: expenseInclude,
});

const record = async ({ branchId, taxExpenseId, employeeId }) => prisma.$transaction(async (tx) => {
  const current = await tx.taxExpense.findFirst({
    where: { id: Number(taxExpenseId), branchId: Number(branchId) },
    select: { id: true, status: true },
  });
  if (!current) return null;
  if (current.status !== 'DRAFT') {
    const error = new Error('Only DRAFT expenses can be recorded');
    error.code = 'TAX_EXPENSE_TRANSITION_FORBIDDEN';
    error.statusCode = 409;
    throw error;
  }

  return tx.taxExpense.update({
    where: { id: current.id },
    data: {
      status: 'RECORDED',
      lifecycleEvents: {
        create: {
          eventType: 'RECORDED',
          previousStatus: 'DRAFT',
          resultingStatus: 'RECORDED',
          actorEmployeeId: Number(employeeId),
        },
      },
    },
    include: expenseInclude,
  });
});

module.exports = Object.freeze({ create, findById, list, record });
