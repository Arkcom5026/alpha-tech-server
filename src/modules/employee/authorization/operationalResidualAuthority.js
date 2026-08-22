'use strict';

const {
  normalizeCapabilityArray,
  resolveActorCapabilities,
} = require('./employeePositionAuthority');

const OPERATIONAL_RESIDUAL_CAPABILITIES = Object.freeze({
  COMMUNICATION_VIEW: 'communication.view',
  COMMUNICATION_PROFILE_MANAGE: 'communication.profile.manage',
  STORE_EXPERIENCE_READ: 'store-experience.read',
  STORE_EXPERIENCE_MANAGE: 'store-experience.manage',
  STORE_EXPERIENCE_PUBLISH: 'store-experience.publish',
  STORE_EXPERIENCE_MEDIA: 'store-experience.media',
  PRODUCT_TRACE_READ: 'product.trace.read',
  PRODUCT_TRACE_FINANCIALS: 'product.trace.financials',
});

const normalizeUpper = (value) => String(value || '').trim().toUpperCase();

const resolveResidualCapability = (actor = {}, capability, { legacyRoles = [], legacyAuthenticated = false } = {}) => {
  const key = String(capability || '').trim();
  if (!key) return false;

  const resolved = resolveActorCapabilities(actor);
  if (resolved.mode === 'SYSTEM_ROLE') return true;
  if (resolved.mode === 'POSITION') {
    const positionCapabilities = normalizeCapabilityArray(actor.positionCapabilities) || [];
    return positionCapabilities.includes(key);
  }

  if (legacyAuthenticated && actor?.id) return true;
  const legacyRole = normalizeUpper(actor.employeeRole || actor.v2Role);
  return legacyRoles.map(normalizeUpper).includes(legacyRole);
};

module.exports = {
  OPERATIONAL_RESIDUAL_CAPABILITIES,
  resolveResidualCapability,
};
