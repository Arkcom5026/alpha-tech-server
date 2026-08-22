'use strict';

const OPERATIONAL_POSITION_CAPABILITIES = Object.freeze({
  COMMUNICATION_OPERATE: 'communication.operate',
  COMMUNICATION_PROFILE_MANAGE: 'communication.profile.manage',
  STORE_EXPERIENCE_READ: 'store-experience.read',
  STORE_EXPERIENCE_MANAGE: 'store-experience.manage',
  STORE_EXPERIENCE_PUBLISH: 'store-experience.publish',
  PRODUCT_TRACE_READ: 'product.trace.read',
  PRODUCT_TRACE_FINANCIALS: 'product.trace.financials',
});

const OPERATIONAL_CAPABILITIES = Object.freeze(Object.values(OPERATIONAL_POSITION_CAPABILITIES));

const normalizeUpper = (value) => String(value || '').trim().toUpperCase();
const normalizeCapabilityArray = (value) => {
  if (!Array.isArray(value)) return null;
  return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
};

const legacyOperationalCapabilitiesForRole = (role) => {
  const normalized = normalizeUpper(role);

  if (normalized === 'OWNER' || normalized === 'MANAGER') {
    return [...OPERATIONAL_CAPABILITIES];
  }

  if (normalized === 'CASHIER' || normalized === 'TECHNICIAN') {
    return [
      OPERATIONAL_POSITION_CAPABILITIES.COMMUNICATION_OPERATE,
      OPERATIONAL_POSITION_CAPABILITIES.STORE_EXPERIENCE_READ,
      OPERATIONAL_POSITION_CAPABILITIES.STORE_EXPERIENCE_MANAGE,
      OPERATIONAL_POSITION_CAPABILITIES.STORE_EXPERIENCE_PUBLISH,
      OPERATIONAL_POSITION_CAPABILITIES.PRODUCT_TRACE_READ,
    ];
  }

  return [];
};

const resolveOperationalActorCapabilities = (actor = {}) => {
  const systemRole = normalizeUpper(actor.role);
  if (actor.isSuperAdmin === true || systemRole === 'ADMIN' || systemRole === 'SUPERADMIN' || systemRole === 'SUPPERADMIN') {
    return {
      mode: 'SYSTEM_ROLE',
      capabilities: [...OPERATIONAL_CAPABILITIES],
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
    capabilities: legacyOperationalCapabilitiesForRole(actor.employeeRole || actor.v2Role),
  };
};

const hasOperationalCapability = (actor, capability) => {
  const key = String(capability || '').trim();
  if (!key) return false;
  return resolveOperationalActorCapabilities(actor).capabilities.includes(key);
};

module.exports = {
  OPERATIONAL_POSITION_CAPABILITIES,
  OPERATIONAL_CAPABILITIES,
  legacyOperationalCapabilitiesForRole,
  resolveOperationalActorCapabilities,
  hasOperationalCapability,
};
