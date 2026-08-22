'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
  normalizeCapabilityArray,
} = require('../../employee/authorization/employeePositionAuthority');

const STORE_PAYMENT_ACCOUNT_CAPABILITY = Object.freeze({
  READ: POSITION_CAPABILITIES.FINANCE_BANK_READ,
  MANAGE: POSITION_CAPABILITIES.FINANCE_BANK_MANAGE,
});

const isPlatformAdmin = (actor = {}) => {
  const role = String(actor.role || '').trim().toUpperCase();
  return Boolean(actor.isSuperAdmin) || role === 'ADMIN' || role === 'SUPERADMIN';
};

const createForbiddenError = (requiredCapabilities) => {
  const error = new Error('STORE_PAYMENT_ACCOUNT_ACCESS_FORBIDDEN');
  error.code = 'STORE_PAYMENT_ACCOUNT_ACCESS_FORBIDDEN';
  error.statusCode = 403;
  error.details = { requiredCapabilities };
  return error;
};

const requireStorePaymentAccountRead = (req, _res, next) => {
  const actor = req.user || {};
  if (hasCapability(actor, STORE_PAYMENT_ACCOUNT_CAPABILITY.READ)) return next();
  return next(createForbiddenError([STORE_PAYMENT_ACCOUNT_CAPABILITY.READ]));
};

const requireStorePaymentAccountManage = (req, _res, next) => {
  const actor = req.user || {};
  if (isPlatformAdmin(actor)) return next();

  // Historical mutation authority was platform ADMIN/SUPERADMIN only. During
  // migration, legacy employee roles must not gain mutation access merely from
  // their compatibility capability projection. An explicitly migrated Position
  // may opt in by carrying both bank read and manage capabilities.
  const positionCapabilities = normalizeCapabilityArray(actor.positionCapabilities);
  if (positionCapabilities === null) {
    return next(createForbiddenError([
      STORE_PAYMENT_ACCOUNT_CAPABILITY.READ,
      STORE_PAYMENT_ACCOUNT_CAPABILITY.MANAGE,
    ]));
  }

  const required = [
    STORE_PAYMENT_ACCOUNT_CAPABILITY.READ,
    STORE_PAYMENT_ACCOUNT_CAPABILITY.MANAGE,
  ];
  const missing = required.filter((capability) => !positionCapabilities.includes(capability));
  if (missing.length === 0) return next();

  return next(createForbiddenError(required));
};

module.exports = {
  STORE_PAYMENT_ACCOUNT_CAPABILITY,
  requireStorePaymentAccountRead,
  requireStorePaymentAccountManage,
};
