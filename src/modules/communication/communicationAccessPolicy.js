const AppError = require('../../shared/errors/AppError');
const {
  RESIDUAL_POSITION_CAPABILITIES,
  hasResidualCapability,
} = require('../employee/authorization/residualPositionAuthority');

const COMMUNICATION_CAPABILITIES = Object.freeze({
  READ: RESIDUAL_POSITION_CAPABILITIES.COMMUNICATION_READ,
  OPERATE: RESIDUAL_POSITION_CAPABILITIES.COMMUNICATION_OPERATE,
  PROFILE_MANAGE: RESIDUAL_POSITION_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE,
});

const getCommunicationCapabilities = (actor = {}) => Object.freeze({
  viewCommunication: hasResidualCapability(actor, COMMUNICATION_CAPABILITIES.READ),
  operateCommunication: hasResidualCapability(actor, COMMUNICATION_CAPABILITIES.OPERATE),
  manageCommunicationProfiles: hasResidualCapability(actor, COMMUNICATION_CAPABILITIES.PROFILE_MANAGE),
});

const requireCommunicationCapability = (capability) => (req, _res, next) => {
  try {
    if (!getCommunicationCapabilities(req.user)[capability]) {
      throw new AppError(`Communication capability ${capability} is required`, 403);
    }
    next();
  } catch (error) { next(error); }
};

module.exports = {
  COMMUNICATION_CAPABILITIES,
  getCommunicationCapabilities,
  requireCommunicationCapability,
};
