'use strict';

const { prisma } = require('../../../../../lib/prisma');
const repository = require('../repository/supplierAdvanceRepository');

const METHODS = new Set(['CASH', 'TRANSFER', 'CARD', 'QR', 'E_WALLET', 'CHEQUE', 'OTHER']);
const positiveInt = (value, field, code) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw Object.assign(new Error(`${field} must be a positive integer`), {
      code, statusCode: 400, isOperational: true,
    });
  }
  return parsed;
};
const positiveMoney = (value, code) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw Object.assign(new Error('amount must be greater than zero'), {
      code, statusCode: 400, isOperational: true,
    });
  }
  return parsed;
};
const actor = (input) => ({
  branchId: positiveInt(input.branchId, 'branchId', 'SUPPLIER_ADVANCE_BRANCH_REQUIRED'),
  employeeId: positiveInt(input.employeeId, 'employeeId', 'SUPPLIER_ADVANCE_ACTOR_REQUIRED'),
});

const create = async (input) => {
  const method = String(input.method || '').trim().toUpperCase();
  if (!METHODS.has(method)) {
    throw Object.assign(new Error('Unsupported advance payment method'), {
      code: 'SUPPLIER_ADVANCE_METHOD_INVALID', statusCode: 400, isOperational: true,
    });
  }
  const paidAt = new Date(input.paidAt || Date.now());
  if (Number.isNaN(paidAt.getTime())) {
    throw Object.assign(new Error('paidAt must be a valid date'), {
      code: 'SUPPLIER_ADVANCE_DATE_INVALID', statusCode: 400, isOperational: true,
    });
  }
  return prisma.$transaction((tx) => repository.create({
    ...actor(input),
    supplierId: positiveInt(input.supplierId, 'supplierId', 'SUPPLIER_ADVANCE_SUPPLIER_REQUIRED'),
    amount: positiveMoney(input.amount, 'SUPPLIER_ADVANCE_AMOUNT_REQUIRED'),
    method,
    paidAt,
    paymentRef: String(input.paymentRef || '').trim() || null,
    note: String(input.note || '').trim() || null,
  }, tx));
};

const list = (input) => repository.list({
  branchId: positiveInt(input.branchId, 'branchId', 'SUPPLIER_ADVANCE_BRANCH_REQUIRED'),
  supplierId: input.supplierId
    ? positiveInt(input.supplierId, 'supplierId', 'SUPPLIER_ADVANCE_SUPPLIER_REQUIRED')
    : null,
  status: input.status ? String(input.status).trim().toUpperCase() : null,
  limit: input.limit,
});

const normalizeAllocations = (input) => {
  const seen = new Set();
  const allocations = (input.allocations || []).map((item) => ({
    payableId: positiveInt(item.payableId, 'payableId', 'SUPPLIER_ADVANCE_PAYABLE_REQUIRED'),
    amount: positiveMoney(item.amount, 'SUPPLIER_ADVANCE_ALLOCATIONS_REQUIRED'),
  }));
  if (!allocations.length) {
    throw Object.assign(new Error('At least one advance allocation is required'), {
      code: 'SUPPLIER_ADVANCE_ALLOCATIONS_REQUIRED', statusCode: 400, isOperational: true,
    });
  }
  if (allocations.some((item) => seen.has(item.payableId) || !seen.add(item.payableId))) {
    throw Object.assign(new Error('Duplicate payable allocation'), {
      code: 'SUPPLIER_ADVANCE_ALLOCATION_DUPLICATE', statusCode: 400, isOperational: true,
    });
  }
  return allocations;
};

const apply = (input) => prisma.$transaction((tx) => repository.apply({
  branchId: positiveInt(input.branchId, 'branchId', 'SUPPLIER_ADVANCE_BRANCH_REQUIRED'),
  advanceId: positiveInt(input.advanceId, 'advanceId', 'SUPPLIER_ADVANCE_ID_REQUIRED'),
  supplierId: positiveInt(input.supplierId, 'supplierId', 'SUPPLIER_ADVANCE_SUPPLIER_REQUIRED'),
  allocations: normalizeAllocations(input),
}, tx));

const activateLegacy = (input) => prisma.$transaction((tx) => repository.activateLegacy({
  ...actor(input),
  advanceId: positiveInt(input.advanceId, 'advanceId', 'SUPPLIER_ADVANCE_ID_REQUIRED'),
  availableAmount: positiveMoney(input.availableAmount, 'SUPPLIER_ADVANCE_AVAILABLE_INVALID'),
}, tx));

const voidAdvance = (input) => {
  const reason = String(input.reason || '').trim();
  if (!reason) {
    throw Object.assign(new Error('Void reason is required'), {
      code: 'SUPPLIER_ADVANCE_VOID_REASON_REQUIRED', statusCode: 400, isOperational: true,
    });
  }
  return prisma.$transaction((tx) => repository.voidAdvance({
    ...actor(input),
    advanceId: positiveInt(input.advanceId, 'advanceId', 'SUPPLIER_ADVANCE_ID_REQUIRED'),
    reason,
  }, tx));
};

module.exports = Object.freeze({ activateLegacy, apply, create, list, voidAdvance });
