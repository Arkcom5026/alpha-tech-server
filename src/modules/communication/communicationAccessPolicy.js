const AppError = require('../../shared/errors/AppError');
const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../employee/authorization/employeePositionAuthority');

const getCommunicationCapabilities = (actor = {}) => {
  const authenticatedEmployee = Number.isInteger(Number(actor.employeeId)) && Number(actor.employeeId) > 0;
  const viewCommunication = authenticatedEmployee
    && hasCapability(actor, POSITION_CAPABILITIES.COMMUNICATION_ACCESS);
  const manageCommunicationProfiles = viewCommunication
    && hasCapability(actor, POSITION_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE);

  return Object.freeze({
    viewCommunication,
    manageCommunicationProfiles,
  });
};

const requireCommunicationCapability = (capability) => (req, _res, next) => {
  try {
    if (!getCommunicationCapabilities(req.user)[capability]) {
      throw new AppError(`Communication capability ${capability} is required`, 403);
    }
    next();
  } catch (error) { next(error); }
};

module.exports = { getCommunicationCapabilities, requireCommunicationCapability };
