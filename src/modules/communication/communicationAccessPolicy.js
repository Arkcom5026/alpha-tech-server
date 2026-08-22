const AppError = require('../../shared/errors/AppError');
const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../employee/authorization/employeePositionAuthority');

const COMMUNICATION_CAPABILITY = Object.freeze({
  READ: POSITION_CAPABILITIES.COMMUNICATION_READ,
  PROFILE_MANAGE: POSITION_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE,
});

const getCommunicationCapabilities = (actor = {}) => Object.freeze({
  viewCommunication: hasCapability(actor, COMMUNICATION_CAPABILITY.READ),
  manageCommunicationProfiles: hasCapability(actor, COMMUNICATION_CAPABILITY.PROFILE_MANAGE),
});

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

module.exports = {
  COMMUNICATION_CAPABILITY,
  getCommunicationCapabilities,
  requireCommunicationCapability,
};
