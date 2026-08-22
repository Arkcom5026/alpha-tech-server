const AppError = require('../../shared/errors/AppError');
const {
  RESIDUAL_POSITION_CAPABILITIES,
  hasResidualCapability,
} = require('../employee/authorization/residualPositionAuthority');

const COMMUNICATION_CAPABILITY = Object.freeze({
  READ: RESIDUAL_POSITION_CAPABILITIES.COMMUNICATION_READ,
  PROFILE_MANAGE: RESIDUAL_POSITION_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE,
});

const LEGACY_COMMUNICATION_READ_ROLES = Object.freeze(['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN']);
const LEGACY_COMMUNICATION_PROFILE_MANAGE_ROLES = Object.freeze(['OWNER', 'MANAGER']);

const getCommunicationCapabilities = (actor = {}) => {
  const authenticatedEmployee = Number.isInteger(Number(actor.employeeId)) && Number(actor.employeeId) > 0;
  const viewCommunication = authenticatedEmployee && hasResidualCapability(
    actor,
    COMMUNICATION_CAPABILITY.READ,
    { legacyRoles: LEGACY_COMMUNICATION_READ_ROLES },
  );
  const manageCommunicationProfiles = authenticatedEmployee && hasResidualCapability(
    actor,
    COMMUNICATION_CAPABILITY.PROFILE_MANAGE,
    { legacyRoles: LEGACY_COMMUNICATION_PROFILE_MANAGE_ROLES },
  );

  return Object.freeze({ viewCommunication, manageCommunicationProfiles });
};

const requireCommunicationCapability = (capability) => (req, _res, next) => {
  try {
    if (!getCommunicationCapabilities(req.user)[capability]) {
      throw new AppError(`Communication capability ${capability} is required`, 403);
    }
    next();
  } catch (error) { next(error); }
};

module.exports = {
  COMMUNICATION_CAPABILITY,
  getCommunicationCapabilities,
  requireCommunicationCapability,
};
