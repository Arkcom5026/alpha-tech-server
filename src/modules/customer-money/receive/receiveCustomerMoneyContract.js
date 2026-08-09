'use strict';

const PAYMENT_METHODS = new Set(['CASH', 'TRANSFER', 'CARD', 'QR', 'E_WALLET', 'CHEQUE', 'OTHER']);

const asPositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const asText = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
};

const buildContractError = (details) => {
  const error = new Error('ข้อมูลรับเงินไม่ถูกต้อง');
  error.code = 'CUSTOMER_MONEY_RECEIVE_INVALID_INPUT';
  error.statusCode = 400;
  error.details = details;
  return error;
};

const validateReceiveCustomerMoneyInput = (input = {}, user = {}) => {
  const errors = [];
  const customerId = asPositiveInt(input.customerId);
  const branchId = asPositiveInt(user.branchId);
  const createdById = asPositiveInt(user.employeeProfileId ?? user.employeeId);
  const amount = Number(input.amount);
  const paymentMethod = asText(input.paymentMethod)?.toUpperCase() || null;
  const description = asText(input.description ?? input.note);
  const paymentReference = asText(input.paymentReference ?? input.referenceNo);
  const receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date();

  if (!customerId) errors.push('customerId is required');
  if (!branchId) errors.push('branch context is required');
  if (!createdById) errors.push('employee context is required');
  if (!Number.isFinite(amount) || amount <= 0) errors.push('amount must be greater than zero');
  if (!paymentMethod || !PAYMENT_METHODS.has(paymentMethod)) errors.push('paymentMethod is invalid');
  if (!description) errors.push('description is required');
  if (Number.isNaN(receivedAt.getTime())) errors.push('receivedAt is invalid');

  if (errors.length) throw buildContractError(errors);

  return {
    customerId,
    branchId,
    createdById,
    amount,
    paymentMethod,
    paymentReference,
    description,
    receivedAt,
  };
};

module.exports = { validateReceiveCustomerMoneyInput, PAYMENT_METHODS };
