const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');

const requireSaleSettlementClose = (req, res, next) => {
  const requiredCapabilities = [POSITION_CAPABILITIES.SALES_SETTLEMENT_CLOSE];
  if (!hasCapability(req.user, requiredCapabilities[0])) {
    return res.status(403).json({
      code: 'SALE_SETTLEMENT_FORBIDDEN',
      message: 'You do not have permission to close sale settlement',
      details: { requiredCapabilities },
    });
  }
  return next();
};

module.exports = { requireSaleSettlementClose };
