'use strict';

const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../../../employee/authorization/employeePositionAuthority');

const DAILY_CLOSING_CAPABILITY = Object.freeze({
  READ: POSITION_CAPABILITIES.FINANCE_DAILY_CLOSING_READ,
});

const requireDailyClosingRead = (req, res, next) => {
  if (hasCapability(req.user || {}, DAILY_CLOSING_CAPABILITY.READ)) return next();

  return res.status(403).json({
    message: 'DAILY_CLOSING_ACCESS_FORBIDDEN',
    code: 'DAILY_CLOSING_ACCESS_FORBIDDEN',
    details: {
      requiredCapabilities: [DAILY_CLOSING_CAPABILITY.READ],
    },
  });
};

module.exports = {
  DAILY_CLOSING_CAPABILITY,
  requireDailyClosingRead,
};
