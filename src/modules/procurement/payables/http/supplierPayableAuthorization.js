'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');

const SUPPLIER_PAYABLE_CAPABILITY = Object.freeze({
  READ: POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER_PAYABLE_READ,
  MANAGE: POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER_PAYABLE_MANAGE,
  CONTROL: POSITION_CAPABILITIES.PROCUREMENT_SUPPLIER_PAYABLE_CONTROL,
});

const createForbiddenError = (requiredCapabilities) => {
  const error = new Error('SUPPLIER_PAYABLE_ACCESS_FORBIDDEN');
  error.code = 'SUPPLIER_PAYABLE_ACCESS_FORBIDDEN';
  error.statusCode = 403;
  error.details = { requiredCapabilities };
  return error;
};

const allowSupplierPayableCapabilities = (...requiredCapabilities) => (req, _res, next) => {
  const missingCapabilities = requiredCapabilities.filter(
    (capability) => !hasCapability(req.user || {}, capability),
  );

  if (missingCapabilities.length > 0) {
    return next(createForbiddenError(requiredCapabilities));
  }

  return next();
};

module.exports = {
  SUPPLIER_PAYABLE_CAPABILITY,
  allowSupplierPayableCapabilities,
};
