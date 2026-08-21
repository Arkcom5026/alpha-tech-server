const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');

const deny = (res, requiredCapabilities) => res.status(403).json({
  code: 'SALE_RETURN_FORBIDDEN',
  message: 'You do not have permission to access sale returns',
  details: { requiredCapabilities },
});

const requireSaleReturnAccess = (req, res, next) => {
  const required = [POSITION_CAPABILITIES.SALES_RETURN];
  if (!hasCapability(req.user, required[0])) return deny(res, required);
  return next();
};

module.exports = { requireSaleReturnAccess };
