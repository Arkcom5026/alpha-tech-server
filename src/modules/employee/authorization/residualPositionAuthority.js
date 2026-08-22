'use strict';

const RESIDUAL_POSITION_CAPABILITIES = Object.freeze({
  COMMUNICATION_READ: 'communication.read',
  COMMUNICATION_OPERATE: 'communication.operate',
  COMMUNICATION_PROFILE_MANAGE: 'communication.profile.manage',
  STORE_EXPERIENCE_READ: 'store-experience.read',
  STORE_EXPERIENCE_MANAGE: 'store-experience.manage',
  STORE_EXPERIENCE_PUBLISH: 'store-experience.publish',
  PRODUCT_TRACE_READ: 'product.trace.read',
  PRODUCT_TRACE_FINANCIALS: 'product.trace.financials',
});

const normalizeUpper = (value) => String(value || '').trim().toUpperCase();
const normalizeCapabilities = (value) => {
  if (!Array.isArray(value)) return null;
  return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
};

const isPlatformAdmin = (actor = {}) => {
  const role = normalizeUpper(actor.role);
  return actor.isSuperAdmin === true || role === 'ADMIN' || role === 'SUPERADMIN' || role === 'SUPPERADMIN';
};

const isEmployeeContext = (actor = {}) => {
  const employeeId = Number(actor.employeeId || actor.profileId);
  return (
    String(actor.profileType || '').trim().toLowerCase() === 'employee' ||
    (Number.isInteger(employeeId) && employeeId > 0)
  );
};

const legacyEmployeeRole = (actor = {}) => normalizeUpper(actor.employeeRole || actor.v2Role);

const legacyResidualCapabilities = (actor = {}) => {
  if (!isEmployeeContext(actor)) return [];

  const capabilities = [
    RESIDUAL_POSITION_CAPABILITIES.COMMUNICATION_READ,
    RESIDUAL_POSITION_CAPABILITIES.COMMUNICATION_OPERATE,
    RESIDUAL_POSITION_CAPABILITIES.STORE_EXPERIENCE_READ,
    RESIDUAL_POSITION_CAPABILITIES.STORE_EXPERIENCE_MANAGE,
    RESIDUAL_POSITION_CAPABILITIES.STORE_EXPERIENCE_PUBLISH,
    RESIDUAL_POSITION_CAPABILITIES.PRODUCT_TRACE_READ,
  ];

  const role = legacyEmployeeRole(actor);
  if (role === 'OWNER' || role === 'MANAGER' || role === 'ADMIN') {
    capabilities.push(
      RESIDUAL_POSITION_CAPABILITIES.COMMUNICATION_PROFILE_MANAGE,
      RESIDUAL_POSITION_CAPABILITIES.PRODUCT_TRACE_FINANCIALS,
    );
  }

  return capabilities;
};

const resolveResidualCapabilities = (actor = {}) => {
  if (isPlatformAdmin(actor)) {
    return {
      mode: 'SYSTEM_ROLE',
      capabilities: Object.values(RESIDUAL_POSITION_CAPABILITIES),
    };
  }

  const positionCapabilities = normalizeCapabilities(actor.positionCapabilities);
  if (positionCapabilities !== null) {
    return {
      mode: 'POSITION',
      capabilities: positionCapabilities,
    };
  }

  return {
    mode: 'V2_ROLE_COMPAT',
    capabilities: legacyResidualCapabilities(actor),
  };
};

const hasResidualCapability = (actor, capability) => {
  const key = String(capability || '').trim();
  if (!key) return false;
  return resolveResidualCapabilities(actor).capabilities.includes(key);
};

module.exports = {
  RESIDUAL_POSITION_CAPABILITIES,
  normalizeCapabilities,
  isPlatformAdmin,
  isEmployeeContext,
  legacyResidualCapabilities,
  resolveResidualCapabilities,
  hasResidualCapability,
};
