'use strict';

const normalizeUpper = (value) => String(value || '').trim().toUpperCase();

const OPERATIONAL_RESIDUAL_CAPABILITIES = Object.freeze({
  COMMUNICATION_ACCESS: 'communication.access',
  COMMUNICATION_PROFILE_MANAGE: 'communication.profile.manage',
  STORE_EXPERIENCE_READ: 'store-experience.read',
  STORE_EXPERIENCE_MANAGE: 'store-experience.manage',
  STORE_EXPERIENCE_PUBLISH: 'store-experience.publish',
  PRODUCT_TRACE_READ: 'product.trace.read',
  PRODUCT_TRACE_FINANCIAL: 'product.trace.financial',
});

const LEGACY_EMPLOYEE_CAPABILITIES = Object.freeze({
  OWNER: Object.freeze(Object.values(OPERATIONAL_RESIDUAL_CAPABILITIES)),
  MANAGER: Object.freeze(Object.values(OPERATIONAL_RESIDUAL_CAPABILITIES)),
  CASHIER: Object.freeze([
    OPERATIONAL_RESIDUAL_CAPABILITIES.COMMUNICATION_ACCESS,
    OPERATIONAL_RESIDUAL_CAPABILITIES.STORE_EXPERIENCE_READ,
    OPERATIONAL_RESIDUAL_CAPABILITIES.STORE_EXPERIENCE_MANAGE,
    OPERATIONAL_RESIDUAL_CAPABILITIES.STORE_EXPERIENCE_PUBLISH,
    OPERATIONAL_RESIDUAL_CAPABILITIES.PRODUCT_TRACE_READ,
  ]),
  TECHNICIAN: Object.freeze([
    OPERATIONAL_RESIDUAL_CAPABILITIES.COMMUNICATION_ACCESS,
    OPERATIONAL_RESIDUAL_CAPABILITIES.STORE_EXPERIENCE_READ,
    OPERATIONAL_RESIDUAL_CAPABILITIES.STORE_EXPERIENCE_MANAGE,
    OPERATIONAL_RESIDUAL_CAPABILITIES.STORE_EXPERIENCE_PUBLISH,
    OPERATIONAL_RESIDUAL_CAPABILITIES.PRODUCT_TRACE_READ,
  ]),
});

const isPlatformAdmin = (actor = {}) => {
  const role = normalizeUpper(actor.role);
  return actor.isSuperAdmin === true || role === 'ADMIN' || role === 'SUPERADMIN' || role === 'SUPPERADMIN';
};

const resolveOperationalResidualCapabilities = (actor = {}) => {
  if (isPlatformAdmin(actor)) {
    return { mode: 'SYSTEM_ROLE', capabilities: Object.values(OPERATIONAL_RESIDUAL_CAPABILITIES) };
  }

  if (Array.isArray(actor.positionCapabilities)) {
    return {
      mode: 'POSITION',
      capabilities: [...new Set(actor.positionCapabilities.map((item) => String(item || '').trim()).filter(Boolean))],
    };
  }

  const legacyRole = normalizeUpper(actor.employeeRole || actor.v2Role);
  return {
    mode: 'V2_ROLE_COMPAT',
    capabilities: LEGACY_EMPLOYEE_CAPABILITIES[legacyRole] || [],
  };
};

const hasOperationalResidualCapability = (actor, capability) => (
  resolveOperationalResidualCapabilities(actor).capabilities.includes(String(capability || '').trim())
);

module.exports = {
  OPERATIONAL_RESIDUAL_CAPABILITIES,
  resolveOperationalResidualCapabilities,
  hasOperationalResidualCapability,
};
