const POSITION_CAPABILITIES = Object.freeze({
  EMPLOYEE_MANAGE: 'employee.manage',
  REPAIR_READ: 'repair.read',
  REPAIR_INTAKE: 'repair.intake',
  REPAIR_WORKFLOW: 'repair.workflow',
  REPAIR_PARTS: 'repair.parts',
  REPAIR_ESTIMATE: 'repair.estimate',
  REPAIR_CLAIM: 'repair.claim',
  REPAIR_HANDOVER: 'repair.handover',
  REPAIR_CUSTOMER_ACCESS: 'repair.customer-access',
  REPAIR_CUSTOMER_OVERRIDE: 'repair.customer-override',
  INVENTORY_ADJUST: 'inventory.adjust',
  INVENTORY_TRANSFER: 'inventory.transfer',
  INVENTORY_AUDIT: 'inventory.audit',
  INVENTORY_AUDIT_FINALIZE: 'inventory.audit.finalize',
  INVENTORY_RECEIVE: 'inventory.receive',
  INVENTORY_LIFECYCLE: 'inventory.lifecycle',
  INVENTORY_QUICK_STOCK: 'inventory.quick-stock',
});

const REPAIR_CAPABILITIES = Object.freeze([
  POSITION_CAPABILITIES.REPAIR_READ,
  POSITION_CAPABILITIES.REPAIR_INTAKE,
  POSITION_CAPABILITIES.REPAIR_WORKFLOW,
  POSITION_CAPABILITIES.REPAIR_PARTS,
  POSITION_CAPABILITIES.REPAIR_ESTIMATE,
  POSITION_CAPABILITIES.REPAIR_CLAIM,
  POSITION_CAPABILITIES.REPAIR_HANDOVER,
  POSITION_CAPABILITIES.REPAIR_CUSTOMER_ACCESS,
  POSITION_CAPABILITIES.REPAIR_CUSTOMER_OVERRIDE,
]);

const INVENTORY_CAPABILITIES = Object.freeze([
  POSITION_CAPABILITIES.INVENTORY_ADJUST,
  POSITION_CAPABILITIES.INVENTORY_TRANSFER,
  POSITION_CAPABILITIES.INVENTORY_AUDIT,
  POSITION_CAPABILITIES.INVENTORY_AUDIT_FINALIZE,
  POSITION_CAPABILITIES.INVENTORY_RECEIVE,
  POSITION_CAPABILITIES.INVENTORY_LIFECYCLE,
  POSITION_CAPABILITIES.INVENTORY_QUICK_STOCK,
]);

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
    return [
      POSITION_CAPABILITIES.EMPLOYEE_MANAGE,
      ...REPAIR_CAPABILITIES,
      ...INVENTORY_CAPABILITIES,
    ];
  }

  if (normalized === 'CASHIER') {
    return [
      POSITION_CAPABILITIES.REPAIR_READ,
      POSITION_CAPABILITIES.REPAIR_INTAKE,
      POSITION_CAPABILITIES.REPAIR_ESTIMATE,
      POSITION_CAPABILITIES.REPAIR_CLAIM,
      POSITION_CAPABILITIES.REPAIR_CUSTOMER_ACCESS,
      POSITION_CAPABILITIES.INVENTORY_AUDIT,
      POSITION_CAPABILITIES.INVENTORY_AUDIT_FINALIZE,
      POSITION_CAPABILITIES.INVENTORY_RECEIVE,
      POSITION_CAPABILITIES.INVENTORY_LIFECYCLE,
      POSITION_CAPABILITIES.INVENTORY_QUICK_STOCK,
    ];
  }

  if (normalized === 'TECHNICIAN') {
    return [
      POSITION_CAPABILITIES.REPAIR_READ,
      POSITION_CAPABILITIES.REPAIR_WORKFLOW,
      POSITION_CAPABILITIES.REPAIR_PARTS,
      POSITION_CAPABILITIES.INVENTORY_AUDIT,
      POSITION_CAPABILITIES.INVENTORY_AUDIT_FINALIZE,
      POSITION_CAPABILITIES.INVENTORY_RECEIVE,
      POSITION_CAPABILITIES.INVENTORY_LIFECYCLE,
      POSITION_CAPABILITIES.INVENTORY_QUICK_STOCK,
    ];
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
  REPAIR_CAPABILITIES,
  INVENTORY_CAPABILITIES,
  normalizeCapabilityArray,
  legacyCapabilitiesForRole,
  deriveCompatibilityRoleFromPosition,
  resolveActorCapabilities,
  hasCapability,
};
