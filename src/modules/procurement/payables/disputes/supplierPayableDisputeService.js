'use strict';

const { prisma } = require('../../../../../lib/prisma');
const repository = require('./supplierPayableDisputeRepository');

const positiveInt = (value, field) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw Object.assign(new Error(`${field} is required`), { code: 'SUPPLIER_DISPUTE_INPUT_INVALID', statusCode: 400, isOperational: true });
  return parsed;
};
const requiredText = (value, field) => {
  const text = String(value || '').trim();
  if (!text) throw Object.assign(new Error(`${field} is required`), { code: 'SUPPLIER_DISPUTE_INPUT_INVALID', statusCode: 400, isOperational: true });
  return text;
};
const amount = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw Object.assign(new Error('amount must be positive'), { code: 'SUPPLIER_DISPUTE_AMOUNT_INVALID', statusCode: 400, isOperational: true });
  return parsed;
};
const adjustment = (input) => {
  if (!input) return null;
  const type = String(input.type || '').toUpperCase();
  const direction = String(input.direction || '').toUpperCase();
  if (!['CREDIT_NOTE', 'DEBIT_NOTE', 'PRICE_CORRECTION', 'SHORTAGE', 'DAMAGE', 'DISCOUNT', 'OTHER'].includes(type)
    || !['CREDIT', 'DEBIT'].includes(direction)) {
    throw Object.assign(new Error('Adjustment type or direction is invalid'), { code: 'SUPPLIER_ADJUSTMENT_TYPE_INVALID', statusCode: 400, isOperational: true });
  }
  const documentDate = input.documentDate ? new Date(input.documentDate) : null;
  if (documentDate && Number.isNaN(documentDate.getTime())) throw Object.assign(new Error('documentDate is invalid'), { code: 'SUPPLIER_ADJUSTMENT_DATE_INVALID', statusCode: 400, isOperational: true });
  return {
    type, direction, amount: amount(input.amount),
    documentNumber: String(input.documentNumber || '').trim() || null,
    documentDate, note: String(input.note || '').trim() || null,
  };
};

const context = (input) => ({
  branchId: positiveInt(input.branchId, 'branchId'),
  employeeId: positiveInt(input.employeeId, 'employeeId'),
});

const list = (input) => repository.list({
  branchId: positiveInt(input.branchId, 'branchId'),
  payableId: input.payableId ? positiveInt(input.payableId, 'payableId') : null,
});
const open = (input) => prisma.$transaction((tx) => repository.open({
  ...context(input), payableId: positiveInt(input.payableId, 'payableId'),
  disputedAmount: amount(input.disputedAmount), reason: requiredText(input.reason, 'reason'),
}, tx));
const createAdjustment = (input) => prisma.$transaction((tx) => repository.createAdjustment({
  ...context(input), payableId: positiveInt(input.payableId, 'payableId'), ...adjustment(input),
}, tx));
const resolve = (input) => prisma.$transaction((tx) => repository.resolve({
  ...context(input), disputeId: positiveInt(input.disputeId, 'disputeId'),
  resolutionNote: requiredText(input.resolutionNote, 'resolutionNote'),
  adjustment: adjustment(input.adjustment),
}, tx));
const voidAdjustment = (input) => prisma.$transaction((tx) => repository.voidAdjustment({
  ...context(input), adjustmentId: positiveInt(input.adjustmentId, 'adjustmentId'),
  reason: requiredText(input.reason, 'reason'),
}, tx));

module.exports = Object.freeze({ createAdjustment, list, open, resolve, voidAdjustment });
