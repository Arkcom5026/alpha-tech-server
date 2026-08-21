'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');

const SALES_DOCUMENT_CAPABILITY = Object.freeze({
  PREPARE: POSITION_CAPABILITIES.SALES_DOCUMENT_PREPARE,
  LOCK: POSITION_CAPABILITIES.SALES_DOCUMENT_LOCK,
  REPLACE: POSITION_CAPABILITIES.SALES_DOCUMENT_REPLACE,
  TAX_PUBLISH: POSITION_CAPABILITIES.SALES_DOCUMENT_TAX_PUBLISH,
});

const allowSalesDocumentCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const actor = req.user || {};
  const allowed = requiredCapabilities.every((capability) => hasCapability(actor, capability));
  if (!allowed) {
    return res.status(403).json({
      error: 'ไม่มีสิทธิ์ดำเนินการเอกสารการขายนี้',
      code: 'SALES_DOCUMENT_FORBIDDEN',
    });
  }
  return next();
};

module.exports = Object.freeze({
  SALES_DOCUMENT_CAPABILITY,
  allowSalesDocumentCapabilities,
});
