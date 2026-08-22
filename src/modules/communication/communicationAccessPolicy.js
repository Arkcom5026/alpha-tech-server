const AppError = require('../../shared/errors/AppError');
const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../employee/authorization/employeePositionAuthority');

const authenticatedEmployee = (actor = {}) => (
  Number.isInteger(Number(actor.employeeId)) && Number(actor.employeeId) > 0
);

const getCommunicationCapabilities = (actor = {}) => {
  const employeeContext = authenticatedEmployee(actor);
  return Object.freeze({
    viewCommunication: employeeContext && hasCapability(actor, POSITION_CAPABILITIES.COMMUNICATION_USE),
    manageCommunicationProfiles: employeeContext && hasCapability(actor, POSITION_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE),
  });
};

const requireCommunicationCapability = (capability) => (req, _res, next) => {
  try {
    if (!getCommunicationCapabilities(req.user)[capability]) throw new AppError(`Communication capability ${capability} is required`, 403);
    next();
  } catch (error) { next(error); }
};

module.exports = { getCommunicationCapabilities, requireCommunicationCapability };
