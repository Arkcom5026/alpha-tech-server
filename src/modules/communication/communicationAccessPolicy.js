const AppError = require('../../shared/errors/AppError');

const normalize = (value) => String(value || '').trim().toUpperCase();

const getCommunicationCapabilities = (actor = {}) => {
  const role = normalize(actor.role);
  const employeeRole = normalize(actor.employeeRole || actor.v2Role || actor.position);
  const authenticatedEmployee = Number.isInteger(Number(actor.employeeId)) && Number(actor.employeeId) > 0;
  const elevated = actor.isSuperAdmin === true || ['ADMIN', 'SUPERADMIN'].includes(role) || ['OWNER', 'MANAGER', 'ADMIN'].includes(employeeRole);
  return Object.freeze({ viewCommunication: authenticatedEmployee, manageCommunicationProfiles: authenticatedEmployee && elevated });
};

const requireCommunicationCapability = (capability) => (req, _res, next) => {
  try {
    if (!getCommunicationCapabilities(req.user)[capability]) throw new AppError(`Communication capability ${capability} is required`, 403);
    next();
  } catch (error) { next(error); }
};

module.exports = { getCommunicationCapabilities, requireCommunicationCapability };
