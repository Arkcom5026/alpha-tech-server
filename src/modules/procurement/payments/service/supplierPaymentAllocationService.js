'use strict';

const { prisma } = require('../../../../../lib/prisma');
const repository = require('../repository/supplierPaymentAllocationRepository');

const METHODS = new Set(['CASH', 'TRANSFER', 'CARD', 'QR', 'E_WALLET', 'CHEQUE', 'OTHER', 'DEPOSIT']);
const positiveInt = (value, field, code) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${field} must be a positive integer`), {
      code, statusCode: 400, isOperational: true,
    });
  }
  return parsed;
};

const createConfirmed = async (input) => {
  const method = String(input.method || '').trim().toUpperCase();
  if (!METHODS.has(method)) {
    throw Object.assign(new Error('Unsupported supplier payment method'), {
      code: 'SUPPLIER_PAYMENT_METHOD_INVALID', statusCode: 400, isOperational: true,
    });
  }
  const paidAt = new Date(input.paidAt || Date.now());
  if (Number.isNaN(paidAt.getTime())) {
    throw Object.assign(new Error('paidAt must be a valid date'), {
      code: 'SUPPLIER_PAYMENT_DATE_INVALID', statusCode: 400, isOperational: true,
    });
  }
  const seen = new Set();
  const allocations = (input.allocations || []).map((item) => ({
    payableId: positiveInt(item.payableId, 'payableId', 'SUPPLIER_PAYMENT_PAYABLE_REQUIRED'),
    amount: Number(item.amount),
  }));
  if (!allocations.length || allocations.some((item) => !Number.isFinite(item.amount) || item.amount <= 0)) {
    throw Object.assign(new Error('At least one positive allocation is required'), {
      code: 'SUPPLIER_PAYMENT_ALLOCATIONS_REQUIRED', statusCode: 400, isOperational: true,
    });
  }
  if (allocations.some((item) => seen.has(item.payableId) || !seen.add(item.payableId))) {
    throw Object.assign(new Error('Duplicate payable allocation'), {
      code: 'SUPPLIER_PAYMENT_ALLOCATION_DUPLICATE', statusCode: 400, isOperational: true,
    });
  }
  return prisma.$transaction((tx) => repository.createConfirmed({
    branchId: positiveInt(input.branchId, 'branchId', 'SUPPLIER_PAYMENT_BRANCH_REQUIRED'),
    supplierId: positiveInt(input.supplierId, 'supplierId', 'SUPPLIER_PAYMENT_SUPPLIER_REQUIRED'),
    employeeId: positiveInt(input.employeeId, 'employeeId', 'SUPPLIER_PAYMENT_ACTOR_REQUIRED'),
    paidAt,
    method,
    paymentRef: String(input.paymentRef || '').trim() || null,
    note: String(input.note || '').trim() || null,
    allocations,
  }, tx));
};

const list = (input) => repository.list({
  branchId: positiveInt(input.branchId, 'branchId', 'SUPPLIER_PAYMENT_BRANCH_REQUIRED'),
  supplierId: input.supplierId
    ? positiveInt(input.supplierId, 'supplierId', 'SUPPLIER_PAYMENT_SUPPLIER_REQUIRED')
    : null,
  limit: input.limit,
});

const voidConfirmed = (input) => {
  const reason = String(input.reason || '').trim();
  if (!reason) {
    throw Object.assign(new Error('Reversal reason is required'), {
      code: 'SUPPLIER_PAYMENT_VOID_REASON_REQUIRED', statusCode: 400, isOperational: true,
    });
  }
  return prisma.$transaction((tx) => repository.voidConfirmed({
    branchId: positiveInt(input.branchId, 'branchId', 'SUPPLIER_PAYMENT_BRANCH_REQUIRED'),
    paymentId: positiveInt(input.paymentId, 'paymentId', 'SUPPLIER_PAYMENT_ID_REQUIRED'),
    employeeId: positiveInt(input.employeeId, 'employeeId', 'SUPPLIER_PAYMENT_ACTOR_REQUIRED'),
    reason,
  }, tx));
};

module.exports = Object.freeze({ createConfirmed, list, voidConfirmed });
