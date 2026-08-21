const POSITION_CAPABILITIES = Object.freeze({
  EMPLOYEE_MANAGE: 'employee.manage',
});

const normalizeUpper = (value) => String(value || '').trim().toUpperCase();

const normalizeCapabilityArray = (value) => {
  if (!Array.isArray(value)) return null;
  return [...new Set(value
    .map((item) => String(item || '').trim())
    .filter(Boolean))];
};

const legacyCapabilitiesForRole = (role) => {
  const normalized = normalizeUpper(role);
  if (normalized === 'OWNER' || normalized === 'MANAGER') {
    return [POSITION_CAPABILITIES.EMPLOYEE_MANAGE];
  }
  return [];
};

const deriveCompatibilityRoleFromPosition = (position = {}) => {
  const capabilities = normalizeCapabilityArray(position.capabilities);
  if (capabilities === null) return null;
  return capabilities.includes(POSITION_CAPABILITIES.EMPLOYEE_MANAGE)
    ? 'MANAGER'
    : 'CASHIER';
};

const resolveActorCapabilities = (actor = {}) => {
  const systemRole = normalizeUpper(actor.role);
  if (actor.isSuperAdmin || systemRole === 'SUPERADMIN' || systemRole === 'ADMIN') {
    return {
      mode: 'SYSTEM_ROLE',
      capabilities: Object.values(POSITION_CAPABILITIES),
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
    capabilities: legacyCapabilitiesForRole(actor.employeeRole || actor.v2Role),
  };
};

const hasCapability = (actor, capability) => {
  const key = String(capability || '').trim();
  if (!key) return false;
  return resolveActorCapabilities(actor).capabilities.includes(key);
};

module.exports = {
  POSITION_CAPABILITIES,
  normalizeCapabilityArray,
  legacyCapabilitiesForRole,
  deriveCompatibilityRoleFromPosition,
  resolveActorCapabilities,
  hasCapability,
};
