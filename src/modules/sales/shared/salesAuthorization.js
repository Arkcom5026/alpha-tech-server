const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../employee/authorization/employeePositionAuthority');

const SALES_CAPABILITY = Object.freeze({
  CORE: POSITION_CAPABILITIES.SALES_CORE,
  COMPLETE: POSITION_CAPABILITIES.SALES_COMPLETE,
});

const allowSalesCapabilities = (...requiredCapabilities) => (req, res, next) => {
  const actor = req.user || {};
  const allowed = requiredCapabilities.every((capability) => hasCapability(actor, capability));

  if (!allowed) {
    return res.status(403).json({
      code: 'SALES_AUTHORITY_FORBIDDEN',
      message: 'ไม่มีสิทธิ์ดำเนินการขายในขอบเขตนี้',
      details: { requiredCapabilities },
    });
  }

  return next();
};

module.exports = {
  SALES_CAPABILITY,
  allowSalesCapabilities,
};
