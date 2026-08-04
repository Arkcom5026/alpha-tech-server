'use strict';

const asPositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const asRequiredText = (value, field) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    const error = new Error(`${field} is required`);
    error.statusCode = 400;
    error.code = 'TAX_EXPENSE_VALIDATION_ERROR';
    throw error;
  }
  return normalized;
};

const asOptionalText = (value) => {
  const normalized = String(value ?? '').trim();
  return normalized || null;
};

const asMoney = (value, field, { allowZero = true } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || (!allowZero && parsed === 0)) {
    const error = new Error(`${field} must be a valid non-negative amount`);
    error.statusCode = 400;
    error.code = 'TAX_EXPENSE_VALIDATION_ERROR';
    throw error;
  }
  return parsed.toFixed(2);
};

const invalidDate = (field) => {
  const error = new Error(`${field} ไม่ถูกต้อง`);
  error.statusCode = 400;
  error.code = 'TAX_EXPENSE_VALIDATION_ERROR';
  return error;
};

const asRequiredDate = (value, field) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw invalidDate(field);
  return parsed;
};

const asOptionalDate = (value, field) => {
  if (value == null || String(value).trim() === '') return null;
  return asRequiredDate(value, field);
};

const actorEmployeeId = (req) =>
  asPositiveInt(req.user?.employeeProfileId) || asPositiveInt(req.user?.employeeId);

const branchIdFromToken = (req) => {
  const branchId =
    asPositiveInt(req.user?.branchId) ||
    asPositiveInt(req.user?.employeeBranchId) ||
    asPositiveInt(req.user?.currentBranchId);
  if (!branchId) {
    const error = new Error('branchId is required from authenticated token');
    error.statusCode = 400;
    error.code = 'TAX_EXPENSE_BRANCH_CONTEXT_REQUIRED';
    throw error;
  }
  return branchId;
};

const employeeIdFromToken = (req) => {
  const employeeId = actorEmployeeId(req);
  if (!employeeId) {
    const error = new Error('employee profile is required from authenticated token');
    error.statusCode = 400;
    error.code = 'TAX_EXPENSE_EMPLOYEE_CONTEXT_REQUIRED';
    throw error;
  }
  return employeeId;
};

const sendError = (res, error, fallbackMessage) =>
  res.status(error?.statusCode || 500).json({
    ok: false,
    error: error?.code || 'TAX_EXPENSE_RUNTIME_ERROR',
    message: error?.message || fallbackMessage,
  });

module.exports = Object.freeze({
  asMoney,
  asOptionalDate,
  asOptionalText,
  asPositiveInt,
  asRequiredDate,
  asRequiredText,
  branchIdFromToken,
  employeeIdFromToken,
  sendError,
});
