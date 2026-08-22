const AppError = require('../../shared/errors/AppError');
const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../employee/authorization/employeePositionAuthority');

const getCommunicationCapabilities = (actor = {}) => {
  const authenticatedEmployee = Number.isInteger(Number(actor.employeeId)) && Number(actor.employeeId) > 0;
  return Object.freeze({
    viewCommunication:
      authenticatedEmployee && hasCapability(actor, POSITION_CAPABILITIES.COMMUNICATION_USE),
    manageCommunicationProfiles:
      authenticatedEmployee && hasCapability(actor, POSITION_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE),
  });
};

const requireCommunicationCapability = (capability) => (req, _res, next) => {
  try {
    if (!getCommunicationCapabilities(req.user)[capability]) {
      throw new AppError(`Communication capability ${capability} is required`, 403);
    }
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { getCommunicationCapabilities, requireCommunicationCapability };
