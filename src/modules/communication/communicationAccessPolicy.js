const AppError = require('../../shared/errors/AppError');
const {
  OPERATIONAL_RESIDUAL_CAPABILITIES,
  hasOperationalResidualCapability,
} = require('../employee/authorization/operationalResidualAuthority');

const getCommunicationCapabilities = (actor = {}) => {
  const authenticatedEmployee = Number.isInteger(Number(actor.employeeId)) && Number(actor.employeeId) > 0;
  return Object.freeze({
    viewCommunication: authenticatedEmployee && hasOperationalResidualCapability(
      actor,
      OPERATIONAL_RESIDUAL_CAPABILITIES.COMMUNICATION_ACCESS,
    ),
    manageCommunicationProfiles: authenticatedEmployee && hasOperationalResidualCapability(
      actor,
      OPERATIONAL_RESIDUAL_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE,
    ),
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
