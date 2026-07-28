'use strict';

const { prisma } = require('../../../../../lib/prisma');
const repository = require('../repository/supplierPayableRepository');

const positiveInt = (value, field, code) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${field} must be a positive integer`), {
      code,
      statusCode: 400,
      isOperational: true,
    });
  }
  return parsed;
};

const optionalDate = (value, field) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw Object.assign(new Error(`${field} must be a valid date`), {
      code: 'SUPPLIER_PAYABLE_DATE_INVALID',
      statusCode: 400,
      isOperational: true,
      details: { field },
    });
  }
  return parsed;
};

const listCandidates = (input) => repository.listCandidates({
  branchId: positiveInt(input.branchId, 'branchId', 'SUPPLIER_PAYABLE_BRANCH_REQUIRED'),
  supplierId: input.supplierId ? positiveInt(input.supplierId, 'supplierId', 'SUPPLIER_PAYABLE_SUPPLIER_REQUIRED') : null,
  limit: input.limit,
});

const list = (input) => repository.list({
  branchId: positiveInt(input.branchId, 'branchId', 'SUPPLIER_PAYABLE_BRANCH_REQUIRED'),
  supplierId: input.supplierId ? positiveInt(input.supplierId, 'supplierId', 'SUPPLIER_PAYABLE_SUPPLIER_REQUIRED') : null,
  status: input.status ? String(input.status).trim().toUpperCase() : null,
  limit: input.limit,
});

const createFromReceipts = async (input) => {
  const receiptIds = [...new Set((input.receiptIds || []).map(Number))];
  if (!receiptIds.length || receiptIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw Object.assign(new Error('receiptIds must contain at least one receipt'), {
      code: 'SUPPLIER_PAYABLE_RECEIPTS_REQUIRED',
      statusCode: 400,
      isOperational: true,
    });
  }
  const documentDate = optionalDate(input.documentDate, 'documentDate');
  const dueDate = optionalDate(input.dueDate, 'dueDate');
  if (documentDate && dueDate && dueDate < documentDate) {
    throw Object.assign(new Error('dueDate cannot be earlier than documentDate'), {
      code: 'SUPPLIER_PAYABLE_DUE_DATE_INVALID',
      statusCode: 400,
      isOperational: true,
    });
  }
  return prisma.$transaction((tx) => repository.createFromReceipts({
    branchId: positiveInt(input.branchId, 'branchId', 'SUPPLIER_PAYABLE_BRANCH_REQUIRED'),
    supplierId: positiveInt(input.supplierId, 'supplierId', 'SUPPLIER_PAYABLE_SUPPLIER_REQUIRED'),
    receiptIds,
    documentNumber: String(input.documentNumber || '').trim() || null,
    documentDate,
    dueDate,
    note: String(input.note || '').trim() || null,
    createdById: positiveInt(input.createdById, 'createdById', 'SUPPLIER_PAYABLE_ACTOR_REQUIRED'),
  }, tx));
};

module.exports = Object.freeze({ createFromReceipts, list, listCandidates });
