'use strict';

const BUSINESS_ACCOUNTING_FIRM_ASSIGNMENT_CONTRACT_VERSION = 'P1_STEP_4_V1';

const ASSIGNMENT_STATUSES = Object.freeze([
  'PENDING_ACCEPTANCE',
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
  'EXPIRED',
  'DECLINED',
]);

const TERMINAL_ASSIGNMENT_STATUSES = Object.freeze([
  'REVOKED',
  'EXPIRED',
  'DECLINED',
]);

const BUSINESS_ASSIGNMENT_AUTHORITY_ROLES = Object.freeze(['OWNER', 'ADMIN']);
const ORGANIZATION_ASSIGNMENT_AUTHORITY_ROLES = Object.freeze(['OWNER', 'ADMIN']);

const ASSIGNMENT_EVENTS = Object.freeze([
  'ASSIGNMENT_REQUESTED',
  'ASSIGNMENT_ACCEPTED',
  'ASSIGNMENT_DECLINED',
  'ASSIGNMENT_ACTIVATED',
  'ASSIGNMENT_SUSPENDED',
  'ASSIGNMENT_RESUMED',
  'ASSIGNMENT_REVOKED',
  'ASSIGNMENT_EXPIRED',
]);

const assignmentTransitions = Object.freeze({
  PENDING_ACCEPTANCE: Object.freeze(['ACTIVE', 'DECLINED', 'REVOKED']),
  ACTIVE: Object.freeze(['SUSPENDED', 'REVOKED', 'EXPIRED']),
  SUSPENDED: Object.freeze(['ACTIVE', 'REVOKED', 'EXPIRED']),
  REVOKED: Object.freeze([]),
  EXPIRED: Object.freeze([]),
  DECLINED: Object.freeze([]),
});

const businessAccountingFirmAssignmentContract = Object.freeze({
  version: BUSINESS_ACCOUNTING_FIRM_ASSIGNMENT_CONTRACT_VERSION,
  aggregate: Object.freeze({
    name: 'BusinessAccountingFirmAssignment',
    businessOwnerAggregate: 'Business',
    assignedOrganizationAggregate: 'ExternalOrganization',
    requiredOrganizationType: 'ACCOUNTING_FIRM',
  }),
  ownership: Object.freeze({
    businessOwnsClientData: true,
    externalOrganizationOwnsClientData: false,
    externalOrganizationCanSelfAssign: false,
    businessRevocationRequiresOrganizationApproval: false,
  }),
  statuses: ASSIGNMENT_STATUSES,
  terminalStatuses: TERMINAL_ASSIGNMENT_STATUSES,
  transitions: assignmentTransitions,
  authority: Object.freeze({
    businessRolesThatMayRequestOrRevoke: BUSINESS_ASSIGNMENT_AUTHORITY_ROLES,
    organizationRolesThatMayAcceptOrDecline: ORGANIZATION_ASSIGNMENT_AUTHORITY_ROLES,
    clientIdentifiersAreSelectorsOnly: true,
    databaseRevalidationRequired: true,
    platformRepairRequiresExplicitAuditableOverride: true,
  }),
  effectiveAccess: Object.freeze({
    requiresActiveAssignment: true,
    requiresActivePermissionScope: true,
    assignmentAloneGrantsPermission: false,
    permissionSurvivesIneffectiveAssignment: false,
    denyOnMissingOrAmbiguousAuthority: true,
  }),
  effectivePeriod: Object.freeze({
    requiresEffectiveFromReached: true,
    deniesAtOrAfterEffectiveUntil: true,
    requiresActiveBusiness: true,
    requiresActiveExternalOrganization: true,
    requiresOrganizationAcceptance: true,
  }),
  cardinality: Object.freeze({
    historicalAssignmentsAllowed: true,
    oneEffectiveAssignmentPerBusinessOrganizationPair: true,
    initialPrimaryAccountingFirmPerBusiness: 1,
    historyMustNotBeOverwritten: true,
  }),
  revocation: Object.freeze({
    immediateAuthority: true,
    failClosed: true,
    preservesAssignmentHistory: true,
    preservesPermissionHistory: true,
    preservesAuditEvidence: true,
    requiredMetadata: Object.freeze([
      'revokedAt',
      'revokedByUserId',
      'revokedByBusinessMembershipId',
    ]),
  }),
  auditEvents: ASSIGNMENT_EVENTS,
  isolationInvariants: Object.freeze([
    'BUSINESS_REMAINS_DATA_OWNER',
    'ASSIGNMENT_NEVER_IMPLIES_PERMISSION',
    'PERMISSION_REQUIRES_EFFECTIVE_ASSIGNMENT',
    'CROSS_BUSINESS_ACCESS_DENIED_BY_DEFAULT',
    'CROSS_ORGANIZATION_ASSIGNMENT_USE_DENIED',
    'BRANCH_SCOPE_CANNOT_EXCEED_ASSIGNED_BUSINESS',
    'REVOCATION_IS_FAIL_CLOSED',
    'TERMINAL_ASSIGNMENT_CANNOT_REACTIVATE',
  ]),
  explicitNonGoals: Object.freeze([
    'PRISMA_SCHEMA',
    'MIGRATION',
    'RUNTIME_AUTHORIZATION',
    'ASSIGNMENT_ENDPOINTS',
    'PERMISSION_SCOPE',
    'TAX_WORKSPACE',
    'FRONTEND',
  ]),
  nextStep: 'P1_STEP_5_PERMISSION_SCOPE',
});

module.exports = Object.freeze({
  BUSINESS_ACCOUNTING_FIRM_ASSIGNMENT_CONTRACT_VERSION,
  ASSIGNMENT_STATUSES,
  TERMINAL_ASSIGNMENT_STATUSES,
  BUSINESS_ASSIGNMENT_AUTHORITY_ROLES,
  ORGANIZATION_ASSIGNMENT_AUTHORITY_ROLES,
  ASSIGNMENT_EVENTS,
  assignmentTransitions,
  businessAccountingFirmAssignmentContract,
});
