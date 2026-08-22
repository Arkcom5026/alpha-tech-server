'use strict';

const AppError = require('../../shared/errors/AppError');
const {
  OPERATIONAL_RESIDUAL_CAPABILITIES,
  resolveResidualCapability,
} = require('../employee/authorization/operationalResidualAuthority');

const hasEmployeeContext = (actor = {}) => Number.isInteger(Number(actor.employeeId)) && Number(actor.employeeId) > 0;

const getCommunicationCapabilities = (actor = {}) => {
  const authenticatedEmployee = hasEmployeeContext(actor);
  const viewCommunication = authenticatedEmployee && resolveResidualCapability(
    actor,
    OPERATIONAL_RESIDUAL_CAPABILITIES.COMMUNICATION_VIEW,
    { legacyRoles: ['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN'] },
  );
  const manageCommunicationProfiles = authenticatedEmployee && resolveResidualCapability(
    actor,
    OPERATIONAL_RESIDUAL_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE,
    { legacyRoles: ['OWNER', 'MANAGER'] },
  );

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
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCommunicationCapabilities,
  requireCommunicationCapability,
};
