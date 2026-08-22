'use strict';

const {
  resolveActorCapabilities,
} = require('./employeePositionAuthority');

const RESIDUAL_POSITION_CAPABILITIES = Object.freeze({
  COMMUNICATION_READ: 'communication.read',
  COMMUNICATION_PROFILE_MANAGE: 'communication.profile.manage',
  STORE_EXPERIENCE_MANAGE: 'store-experience.manage',
  STORE_EXPERIENCE_PUBLISH: 'store-experience.publish',
  PRODUCT_TRACE_READ: 'product.trace.read',
  PRODUCT_TRACE_FINANCIAL: 'product.trace.financial',
});

const normalizeUpper = (value) => String(value || '').trim().toUpperCase();

const hasResidualCapability = (
  actor = {},
  capability,
  { legacyRoles = [], authenticatedFallback = false } = {},
) => {
  const resolved = resolveActorCapabilities(actor);

  if (resolved.mode === 'SYSTEM_ROLE') return true;
  if (resolved.mode === 'POSITION') return resolved.capabilities.includes(capability);

  const legacyRole = normalizeUpper(actor.employeeRole || actor.v2Role);
  if (legacyRoles.map(normalizeUpper).includes(legacyRole)) return true;

  return authenticatedFallback && Boolean(actor.id);
};

module.exports = {
  RESIDUAL_POSITION_CAPABILITIES,
  hasResidualCapability,
};
