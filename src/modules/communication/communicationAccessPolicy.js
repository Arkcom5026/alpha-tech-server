const AppError = require('../../shared/errors/AppError');
const {
  POSITION_CAPABILITIES,
  hasCapability,
} = require('../employee/authorization/employeePositionAuthority');

const normalize = (value) => String(value || '').trim().toUpperCase();
const authenticatedEmployee = (actor = {}) => (
  Number.isInteger(Number(actor.employeeId)) && Number(actor.employeeId) > 0
);

const getCommunicationCapabilities = (actor = {}) => {
  const employeeContext = authenticatedEmployee(actor);
  if (!employeeContext) {
    return Object.freeze({ viewCommunication: false, manageCommunicationProfiles: false });
  }

  if (Array.isArray(actor.positionCapabilities)) {
    return Object.freeze({
      viewCommunication: hasCapability(actor, POSITION_CAPABILITIES.COMMUNICATION_USE),
      manageCommunicationProfiles: hasCapability(actor, POSITION_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE),
    });
  }

  const role = normalize(actor.role);
  const employeeRole = normalize(actor.employeeRole || actor.v2Role);
  const elevated = actor.isSuperAdmin === true
    || ['ADMIN', 'SUPERADMIN'].includes(role)
    || ['OWNER', 'MANAGER', 'ADMIN'].includes(employeeRole);

  return Object.freeze({
    viewCommunication: true,
    manageCommunicationProfiles: elevated,
  });
};

const requireCommunicationCapability = (capability) => (req, _res, next) => {
  try {
    if (!getCommunicationCapabilities(req.user)[capability]) throw new AppError(`Communication capability ${capability} is required`, 403);
    next();
  } catch (error) { next(error); }
};

module.exports = { getCommunicationCapabilities, requireCommunicationCapability };
