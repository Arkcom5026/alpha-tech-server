const AppError = require('../../shared/errors/AppError');
const {
  POSITION_CAPABILITIES,
  hasCapability,
  resolveActorCapabilities,
} = require('../employee/authorization/employeePositionAuthority');

const COMMUNICATION_CAPABILITY = Object.freeze({
  READ: POSITION_CAPABILITIES.COMMUNICATION_READ,
  PROFILE_MANAGE: POSITION_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE,
});

const normalize = (value) => String(value || '').trim().toUpperCase();

const getCommunicationCapabilities = (actor = {}) => {
  const resolved = resolveActorCapabilities(actor);

  if (resolved.mode === 'V2_ROLE_COMPAT') {
    const authenticatedEmployee = Number.isInteger(Number(actor.employeeId)) && Number(actor.employeeId) > 0;
    const employeeRole = normalize(actor.employeeRole || actor.v2Role || actor.position);
    const elevated = ['OWNER', 'MANAGER', 'ADMIN'].includes(employeeRole);
    return Object.freeze({
      viewCommunication: authenticatedEmployee,
      manageCommunicationProfiles: authenticatedEmployee && elevated,
    });
  }

  return Object.freeze({
    viewCommunication: hasCapability(actor, COMMUNICATION_CAPABILITY.READ),
    manageCommunicationProfiles: hasCapability(actor, COMMUNICATION_CAPABILITY.PROFILE_MANAGE),
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
  COMMUNICATION_CAPABILITY,
  getCommunicationCapabilities,
  requireCommunicationCapability,
};
