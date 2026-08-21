'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const TAX_PUBLICATION_RETRY_CAPABILITY = Object.freeze({
  READ: POSITION_CAPABILITIES.TAX_PUBLICATION_RETRY_READ,
  EXECUTE: POSITION_CAPABILITIES.TAX_PUBLICATION_RETRY_EXECUTE,
});

const allowTaxPublicationRetryCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const required = requiredCapabilities
    .map((capability) => String(capability || '').trim())
    .filter(Boolean);
  const allowed = required.length > 0
    && required.every((capability) => hasCapability(req.user || {}, capability));

  if (!allowed) {
    return res.status(403).json({
      error: 'ไม่มีสิทธิ์จัดการการเผยแพร่เอกสารภาษีซ้ำ',
      code: 'TAX_PUBLICATION_RETRY_FORBIDDEN',
      requiredCapabilities: required,
    });
  }

  return next();
};

module.exports = Object.freeze({
  TAX_PUBLICATION_RETRY_CAPABILITY,
  allowTaxPublicationRetryCapabilities,
});
