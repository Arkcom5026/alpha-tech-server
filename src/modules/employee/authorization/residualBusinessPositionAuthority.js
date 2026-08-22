'use strict';

const {
  POSITION_CAPABILITIES,
  RESIDUAL_BUSINESS_CAPABILITIES: CENTRAL_RESIDUAL_BUSINESS_CAPABILITIES,
  legacyCapabilitiesForRole,
  resolveActorCapabilities,
  hasCapability,
} = require('./employeePositionAuthority');

const RESIDUAL_BUSINESS_CAPABILITIES = Object.freeze({
  COMMUNICATION_OPERATE: POSITION_CAPABILITIES.COMMUNICATION_OPERATE,
  COMMUNICATION_PROFILE_MANAGE: POSITION_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE,
  STORE_EXPERIENCE_READ: POSITION_CAPABILITIES.STORE_EXPERIENCE_READ,
  STORE_EXPERIENCE_MANAGE: POSITION_CAPABILITIES.STORE_EXPERIENCE_MANAGE,
  STORE_EXPERIENCE_PUBLISH: POSITION_CAPABILITIES.STORE_EXPERIENCE_PUBLISH,
  PRODUCT_TRACE_FINANCIALS: POSITION_CAPABILITIES.PRODUCT_TRACE_FINANCIALS,
});

const ALL_RESIDUAL_BUSINESS_CAPABILITIES = Object.freeze([
  ...CENTRAL_RESIDUAL_BUSINESS_CAPABILITIES,
]);
const residualCapabilitySet = new Set(ALL_RESIDUAL_BUSINESS_CAPABILITIES);
const onlyResidual = (capabilities) => capabilities.filter((capability) => residualCapabilitySet.has(capability));

const legacyResidualCapabilitiesForRole = (role) => onlyResidual(legacyCapabilitiesForRole(role));

const resolveResidualBusinessCapabilities = (actor = {}) => {
  const resolved = resolveActorCapabilities(actor);
  return {
    mode: resolved.mode,
    capabilities: onlyResidual(resolved.capabilities),
  };
};

const hasResidualBusinessCapability = (actor, capability) => hasCapability(actor, capability);

module.exports = {
  RESIDUAL_BUSINESS_CAPABILITIES,
  ALL_RESIDUAL_BUSINESS_CAPABILITIES,
  legacyResidualCapabilitiesForRole,
  resolveResidualBusinessCapabilities,
  hasResidualBusinessCapability,
};
