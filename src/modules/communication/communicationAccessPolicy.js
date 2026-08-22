const AppError = require('../../shared/errors/AppError');
const {
  OPERATIONAL_POSITION_CAPABILITIES,
  hasOperationalCapability,
} = require('../employee/authorization/employeeOperationalPositionAuthority');

const getCommunicationCapabilities = (actor = {}) => {
  const authenticatedEmployee = Number.isInteger(Number(actor.employeeId)) && Number(actor.employeeId) > 0;
  const canOperate = hasOperationalCapability(actor, OPERATIONAL_POSITION_CAPABILITIES.COMMUNICATION_OPERATE);
  const canManageProfiles = hasOperationalCapability(actor, OPERATIONAL_POSITION_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE);

  return Object.freeze({
    viewCommunication: authenticatedEmployee && canOperate,
    manageCommunicationProfiles: authenticatedEmployee && canOperate && canManageProfiles,
  });
};

const requireCommunicationCapability = (capability) => (req, _res, next) => {
  try {
    if (!getCommunicationCapabilities(req.user)[capability]) throw new AppError(`Communication capability ${capability} is required`, 403);
    next();
  } catch (error) { next(error); }
};

module.exports = { getCommunicationCapabilities, requireCommunicationCapability };
