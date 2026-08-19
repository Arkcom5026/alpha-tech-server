'use strict';

const repository = require('./storePaymentAccountRepository');

const text = (value, max) => String(value ?? '').trim().slice(0, max);
const positiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const makeError = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });

const normalizeInput = (body = {}) => {
  const code = text(body.code, 64).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const sortOrderRaw = Number(body.sortOrder);
  return {
    code,
    displayName: text(body.displayName, 160),
    bankName: text(body.bankName, 160),
    accountName: text(body.accountName, 200),
    accountNumber: text(body.accountNumber, 80),
    accountType: text(body.accountType, 80) || null,
    promptPayId: text(body.promptPayId, 80) || null,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
    sortOrder: Number.isInteger(sortOrderRaw) ? Math.max(-999, Math.min(999, sortOrderRaw)) : 0,
  };
};

const validateRequired = (input) => {
  if (!input.code) throw makeError(400, 'STORE_PAYMENT_ACCOUNT_CODE_REQUIRED', 'กรุณารหัสบัญชีรับชำระ');
  if (!input.displayName) throw makeError(400, 'STORE_PAYMENT_ACCOUNT_NAME_REQUIRED', 'กรุณาระบุชื่อที่ใช้แสดงบัญชี');
  if (!input.bankName) throw makeError(400, 'STORE_PAYMENT_ACCOUNT_BANK_REQUIRED', 'กรุณาระบุธนาคาร');
  if (!input.accountName) throw makeError(400, 'STORE_PAYMENT_ACCOUNT_HOLDER_REQUIRED', 'กรุณาระบุชื่อบัญชี');
  if (!input.accountNumber) throw makeError(400, 'STORE_PAYMENT_ACCOUNT_NUMBER_REQUIRED', 'กรุณาระบุเลขบัญชี');
};

const listStorePaymentAccounts = async (branchIdRaw, options) => {
  const branchId = positiveInt(branchIdRaw);
  if (!branchId) throw makeError(403, 'BRANCH_CONTEXT_REQUIRED', 'ไม่พบสาขาสำหรับบัญชีรับชำระ');
  return repository.listByBranch(branchId, options);
};

const getStorePaymentAccount = async (branchIdRaw, idRaw) => {
  const branchId = positiveInt(branchIdRaw);
  const id = positiveInt(idRaw);
  if (!branchId) throw makeError(403, 'BRANCH_CONTEXT_REQUIRED', 'ไม่พบสาขาสำหรับบัญชีรับชำระ');
  if (!id) throw makeError(400, 'STORE_PAYMENT_ACCOUNT_ID_INVALID', 'รหัสบัญชีรับชำระไม่ถูกต้อง');
  const account = await repository.findByBranchAndId(branchId, id);
  if (!account) throw makeError(404, 'STORE_PAYMENT_ACCOUNT_NOT_FOUND', 'ไม่พบบัญชีรับชำระในสาขานี้');
  return account;
};

const createStorePaymentAccount = async (branchIdRaw, body) => {
  const branchId = positiveInt(branchIdRaw);
  if (!branchId) throw makeError(403, 'BRANCH_CONTEXT_REQUIRED', 'ไม่พบสาขาสำหรับบัญชีรับชำระ');
  const input = normalizeInput(body);
  validateRequired(input);
  return repository.create({ branchId, ...input });
};

const updateStorePaymentAccount = async (branchIdRaw, idRaw, body) => {
  const existing = await getStorePaymentAccount(branchIdRaw, idRaw);
  const input = normalizeInput({ ...existing, ...body });
  validateRequired(input);
  return repository.updateByBranchAndId(existing.branchId, existing.id, input);
};

const assertStorePaymentAccountsOwnedByBranch = async (branchIdRaw, accountIds = []) => {
  const branchId = positiveInt(branchIdRaw);
  if (!branchId) throw makeError(403, 'BRANCH_CONTEXT_REQUIRED', 'ไม่พบสาขาสำหรับบัญชีรับชำระ');
  const ids = [...new Set((Array.isArray(accountIds) ? accountIds : []).map(positiveInt).filter(Boolean))];
  for (const id of ids) await getStorePaymentAccount(branchId, id);
  return ids;
};

module.exports = {
  assertStorePaymentAccountsOwnedByBranch,
  createStorePaymentAccount,
  getStorePaymentAccount,
  listStorePaymentAccounts,
  normalizeInput,
  updateStorePaymentAccount,
};
