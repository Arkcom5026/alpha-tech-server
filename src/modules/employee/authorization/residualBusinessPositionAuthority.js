'use strict';

const RESIDUAL_BUSINESS_CAPABILITIES = Object.freeze({
  COMMUNICATION_ACCESS: 'communication.access',
  COMMUNICATION_PROFILE_MANAGE: 'communication.profile.manage',
  PRODUCT_TRACE_READ: 'product.trace.read',
  PRODUCT_TRACE_FINANCIAL: 'product.trace.financial',
  STORE_EXPERIENCE_READ: 'store-experience.read',
  STORE_EXPERIENCE_MANAGE: 'store-experience.manage',
  STORE_EXPERIENCE_PUBLISH: 'store-experience.publish',
});

const ALL_RESIDUAL_BUSINESS_CAPABILITIES = Object.freeze(Object.values(RESIDUAL_BUSINESS_CAPABILITIES));

const normalizeUpper = (value) => String(value || '').trim().toUpperCase();
const normalizeCapabilityArray = (value) => {
  if (!Array.isArray(value)) return null;
  return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
};

const legacyResidualBusinessCapabilitiesForRole = (role) => {
  const normalized = normalizeUpper(role);
  if (normalized === 'OWNER' || normalized === 'MANAGER') {
    return ALL_RESIDUAL_BUSINESS_CAPABILITIES;
  }
  if (normalized === 'CASHIER' || normalized === 'TECHNICIAN') {
    return [
      RESIDUAL_BUSINESS_CAPABILITIES.COMMUNICATION_ACCESS,
      RESIDUAL_BUSINESS_CAPABILITIES.PRODUCT_TRACE_READ,
      RESIDUAL_BUSINESS_CAPABILITIES.STORE_EXPERIENCE_READ,
      RESIDUAL_BUSINESS_CAPABILITIES.STORE_EXPERIENCE_MANAGE,
      RESIDUAL_BUSINESS_CAPABILITIES.STORE_EXPERIENCE_PUBLISH,
    ];
  }
  return [];
};

const resolveResidualBusinessCapabilities = (actor = {}) => {
  const systemRole = normalizeUpper(actor.role);
  if (actor.isSuperAdmin === true || systemRole === 'ADMIN' || systemRole === 'SUPERADMIN') {
    return { mode: 'SYSTEM_ROLE', capabilities: ALL_RESIDUAL_BUSINESS_CAPABILITIES };
  }

  const positionCapabilities = normalizeCapabilityArray(actor.positionCapabilities);
  if (positionCapabilities !== null) {
    return { mode: 'POSITION', capabilities: positionCapabilities };
  }

  return {
    mode: 'V2_ROLE_COMPAT',
    capabilities: legacyResidualBusinessCapabilitiesForRole(actor.employeeRole || actor.v2Role),
  };
};

const hasResidualBusinessCapability = (actor, capability) => {
  const key = String(capability || '').trim();
  if (!key) return false;
  return resolveResidualBusinessCapabilities(actor).capabilities.includes(key);
};

module.exports = {
  RESIDUAL_BUSINESS_CAPABILITIES,
  ALL_RESIDUAL_BUSINESS_CAPABILITIES,
  legacyResidualBusinessCapabilitiesForRole,
  resolveResidualBusinessCapabilities,
  hasResidualBusinessCapability,
};
