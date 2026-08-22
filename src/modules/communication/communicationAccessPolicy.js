const AppError = require('../../shared/errors/AppError');
const {
  RESIDUAL_POSITION_CAPABILITIES,
  hasResidualCapability,
} = require('../employee/authorization/employeePositionResidualAuthority');

const getCommunicationCapabilities = (actor = {}) => {
  const authenticatedEmployee = Number.isInteger(Number(actor.employeeId)) && Number(actor.employeeId) > 0;
  if (!authenticatedEmployee) {
    return Object.freeze({
      viewCommunication: false,
      manageCommunicationProfiles: false,
    });
  }

  return Object.freeze({
    viewCommunication: hasResidualCapability(
      actor,
      RESIDUAL_POSITION_CAPABILITIES.COMMUNICATION_ACCESS,
    ),
    manageCommunicationProfiles: hasResidualCapability(
      actor,
      RESIDUAL_POSITION_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE,
    ),
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

module.exports = {
  getCommunicationCapabilities,
  requireCommunicationCapability,
};
