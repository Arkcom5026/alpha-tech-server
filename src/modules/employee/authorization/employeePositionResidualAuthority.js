'use strict';

const {
  normalizeCapabilityArray,
  resolveActorCapabilities,
} = require('./employeePositionAuthority');

const RESIDUAL_POSITION_CAPABILITIES = Object.freeze({
  COMMUNICATION_ACCESS: 'communication.access',
  COMMUNICATION_PROFILE_MANAGE: 'communication.profile.manage',
  STORE_EXPERIENCE_READ: 'store-experience.read',
  STORE_EXPERIENCE_MANAGE: 'store-experience.manage',
  STORE_EXPERIENCE_PUBLISH: 'store-experience.publish',
  PRODUCT_TRACE_READ: 'product.trace.read',
  PRODUCT_TRACE_FINANCIALS: 'product.trace.financials',
});

const ALL_RESIDUAL_POSITION_CAPABILITIES = Object.freeze(
  Object.values(RESIDUAL_POSITION_CAPABILITIES),
);

const normalizeUpper = (value) => String(value || '').trim().toUpperCase();

const legacyResidualCapabilitiesForRole = (role) => {
  const normalized = normalizeUpper(role);
  if (!['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN'].includes(normalized)) return [];

  const capabilities = [
    RESIDUAL_POSITION_CAPABILITIES.COMMUNICATION_ACCESS,
    RESIDUAL_POSITION_CAPABILITIES.STORE_EXPERIENCE_READ,
    RESIDUAL_POSITION_CAPABILITIES.STORE_EXPERIENCE_MANAGE,
    RESIDUAL_POSITION_CAPABILITIES.STORE_EXPERIENCE_PUBLISH,
    RESIDUAL_POSITION_CAPABILITIES.PRODUCT_TRACE_READ,
  ];

  if (normalized === 'OWNER' || normalized === 'MANAGER') {
    capabilities.push(
      RESIDUAL_POSITION_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE,
      RESIDUAL_POSITION_CAPABILITIES.PRODUCT_TRACE_FINANCIALS,
    );
  }

  return capabilities;
};

const resolveResidualActorCapabilities = (actor = {}) => {
  const baseResolution = resolveActorCapabilities(actor);
  if (baseResolution.mode === 'SYSTEM_ROLE') {
    return {
      mode: 'SYSTEM_ROLE',
      capabilities: ALL_RESIDUAL_POSITION_CAPABILITIES,
    };
  }

  const positionCapabilities = normalizeCapabilityArray(actor.positionCapabilities);
  if (positionCapabilities !== null) {
    return {
      mode: 'POSITION',
      capabilities: positionCapabilities,
    };
  }

  return {
    mode: 'V2_ROLE_COMPAT',
    capabilities: legacyResidualCapabilitiesForRole(actor.employeeRole || actor.v2Role),
  };
};

const hasResidualCapability = (actor, capability) => {
  const key = String(capability || '').trim();
  if (!key) return false;
  return resolveResidualActorCapabilities(actor).capabilities.includes(key);
};

module.exports = {
  RESIDUAL_POSITION_CAPABILITIES,
  ALL_RESIDUAL_POSITION_CAPABILITIES,
  legacyResidualCapabilitiesForRole,
  resolveResidualActorCapabilities,
  hasResidualCapability,
};
