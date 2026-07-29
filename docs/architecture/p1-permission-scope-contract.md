# P1 — Professional Access Foundation

## Step 5: Permission Scope Contract

Status: Repository architecture authority  
Runtime impact: None  
Prerequisite: Step 4 Business-to-Accounting-Firm Assignment

## 1. Purpose

This contract defines the explicit delegated permissions that may be granted from a Business to an External Organization through an effective Business-to-Accounting-Firm Assignment.

An Assignment establishes relationship eligibility only. A Permission Scope defines what the organization may actually do.

The system is deny-by-default and least-privilege by construction.

## 2. Core Aggregate

`DelegatedPermissionScope` belongs to exactly one `BusinessAccountingFirmAssignment`.

Required identity and authority fields:

- `id`
- `assignmentId`
- `businessId`
- `externalOrganizationId`
- `status`
- `resource`
- `actions[]`
- `branchMode`
- `branchIds[]`
- `effectiveFrom`
- `effectiveUntil`
- `constraints`
- `grantedByBusinessMembershipId`
- `grantedAt`
- `suspendedAt`
- `revokedAt`
- `revokedByBusinessMembershipId`
- `revocationReason`
- `createdAt`
- `updatedAt`

The denormalized `businessId` and `externalOrganizationId` must match the parent Assignment. They exist to make authority checks explicit and indexable; they do not replace validation against the Assignment.

## 3. Scope Status

Allowed statuses:

- `DRAFT`
- `ACTIVE`
- `SUSPENDED`
- `REVOKED`
- `EXPIRED`

Terminal statuses:

- `REVOKED`
- `EXPIRED`

A revoked or expired scope cannot be reactivated. A new grant requires a new scope record so historical evidence is preserved.

## 4. Resource Registry

Initial professional-access resources:

- `BUSINESS_PROFILE`
- `BRANCH_PROFILE`
- `CUSTOMER`
- `SUPPLIER`
- `SALE`
- `PURCHASE`
- `INPUT_TAX`
- `OUTPUT_TAX`
- `TAX_FILING_BATCH`
- `PAYMENT`
- `RECEIVABLE`
- `PAYABLE`
- `INVENTORY`
- `PRODUCT`
- `EMPLOYEE`
- `REPAIR`
- `WARRANTY_CLAIM`
- `DOCUMENT_ATTACHMENT`
- `AUDIT_EVENT`

Resources are explicit registry values. Arbitrary strings from clients must not become effective resources.

## 5. Action Registry

Initial actions:

- `READ`
- `LIST`
- `REVIEW`
- `COMMENT`
- `UPLOAD_SUPPORTING_DOCUMENT`
- `EXPORT`
- `PREPARE`
- `SUBMIT_FOR_BUSINESS_APPROVAL`
- `FILE`
- `CREATE`
- `UPDATE`
- `VOID`

Actions are evaluated per resource. A scope must not imply actions that are absent from `actions[]`.

Dangerous actions require additional policy:

- `FILE`
- `CREATE`
- `UPDATE`
- `VOID`
- `EXPORT`

The presence of an action in a scope is necessary but may not be sufficient. Domain policies may impose approval, separation-of-duties, document state, monetary threshold, or filing-window requirements.

## 6. Branch Boundary

`branchMode` values:

- `ALL_BUSINESS_BRANCHES`
- `SELECTED_BRANCHES`
- `NO_BRANCH_CONTEXT`

Rules:

- `ALL_BUSINESS_BRANCHES` covers only branches currently owned by the Assignment Business.
- `SELECTED_BRANCHES` requires a non-empty `branchIds[]` list.
- Every selected Branch must belong to the same Business as the Assignment.
- `NO_BRANCH_CONTEXT` is allowed only for resources that are genuinely Business-level.
- A branch identifier supplied by a client is a selector and must be checked against the effective scope.
- A future Branch added to a Business is not automatically included in `SELECTED_BRANCHES`.
- A future Branch is included in `ALL_BUSINESS_BRANCHES` only while it remains owned by the same Business and all other authority conditions pass.

## 7. Effective Period

A scope is temporally effective only when:

- `effectiveFrom <= now`
- `effectiveUntil` is null or `now < effectiveUntil`
- status is `ACTIVE`

Authorization must evaluate time directly. Access must fail closed when the effective period has ended even if a scheduled status update has not yet changed the stored status to `EXPIRED`.

## 8. Constraints

`constraints` is a typed policy object, not an unvalidated free-form authority source.

Initial supported constraints:

- `documentDateFrom`
- `documentDateUntil`
- `fiscalYears[]`
- `taxPeriods[]`
- `maxExportRows`
- `requiresBusinessApproval`
- `allowPersonalData`
- `allowCostData`
- `allowEmployeeData`
- `allowedDocumentStatuses[]`

Defaults are restrictive:

- Personal data access: denied unless explicitly allowed and required by the resource.
- Cost data access: denied unless explicitly allowed.
- Employee data access: denied unless explicitly allowed.
- Export: denied unless `EXPORT` is granted and export constraints pass.
- Filing: denied unless `FILE` is granted and domain approval requirements pass.

Unknown constraints must not broaden access.

## 9. Grant Authority

Only an active Business Membership with role:

- `OWNER`
- `ADMIN`

may activate, suspend, replace, or revoke a Permission Scope.

A Business `MANAGER`, `STAFF`, or `VIEWER` cannot grant delegated professional access by default.

An External Organization member cannot grant itself a Business Permission Scope.

Platform authority must be explicit, audited, and governed by a separate platform policy. It must not be inferred from Business or Organization roles.

## 10. Effective Access Evaluation

Delegated access is effective only when every condition passes:

1. User exists and is enabled.
2. External Organization exists and is `ACTIVE`.
3. External Organization Membership exists and is active.
4. Membership belongs to the same External Organization as the Assignment.
5. Assignment exists and is effective.
6. Assignment belongs to the requested Business.
7. Permission Scope exists and is effective.
8. Scope belongs to the same Assignment, Business, and External Organization.
9. Requested resource exactly matches the Scope resource.
10. Requested action is explicitly present in `actions[]`.
11. Requested Branch satisfies the Scope branch boundary.
12. Requested period and document state satisfy all constraints.
13. Domain-specific policy passes.

Any missing, stale, conflicting, suspended, revoked, expired, or mismatched authority causes denial.

## 11. Request Authority Projection

Target request projection:

```js
req.auth = {
  userId,
  platformRole,
  activeBusinessId,
  activeBranchId,
  businessMembership,
  externalOrganizationMembership,
  assignment,
  permissionScopes,
  authorityVersion,
  evaluatedAt,
};
```

This projection is derived from database-revalidated state. JWT claims and client-provided identifiers are not sufficient authority.

For a specific operation, the policy evaluator should return an immutable decision record:

```js
{
  allowed,
  decisionCode,
  businessId,
  branchId,
  resource,
  action,
  assignmentId,
  permissionScopeId,
  evaluatedAt,
}
```

## 12. Denial Codes

Initial stable denial reasons:

- `BUSINESS_CONTEXT_REQUIRED`
- `EXTERNAL_ORGANIZATION_INACTIVE`
- `EXTERNAL_ORGANIZATION_MEMBERSHIP_REQUIRED`
- `ASSIGNMENT_NOT_EFFECTIVE`
- `PERMISSION_SCOPE_REQUIRED`
- `PERMISSION_SCOPE_NOT_EFFECTIVE`
- `RESOURCE_NOT_GRANTED`
- `ACTION_NOT_GRANTED`
- `BRANCH_NOT_GRANTED`
- `PERIOD_NOT_GRANTED`
- `DOCUMENT_STATUS_NOT_GRANTED`
- `PERSONAL_DATA_NOT_GRANTED`
- `COST_DATA_NOT_GRANTED`
- `EMPLOYEE_DATA_NOT_GRANTED`
- `BUSINESS_APPROVAL_REQUIRED`
- `DOMAIN_POLICY_DENIED`
- `AUTHORITY_CONTEXT_MISMATCH`

Error responses must not expose unrelated Business, Branch, or organization existence to unauthorized callers.

## 13. Audit Evidence

Every lifecycle change must retain:

- Actor User
- Actor Business Membership or explicit platform authority
- Parent Assignment
- Previous status and new status
- Previous scope and new scope
- Reason
- Request/correlation identifier
- Timestamp

Every sensitive delegated action should retain the effective Assignment and Permission Scope used for the decision.

Revocation never deletes historical actions, documents, comments, exports, filing records, or audit evidence.

## 14. Isolation Invariants

- A Scope never crosses Business boundaries.
- A Scope never crosses External Organization boundaries.
- A Scope never survives an ineffective Assignment.
- Organization membership alone grants no Business access.
- Assignment alone grants no Business-data permission.
- Resource grants do not imply other resources.
- Action grants do not imply other actions.
- Branch grants do not imply other branches.
- Read access does not imply export permission.
- Review access does not imply update or filing permission.
- Client identifiers are selectors only.
- Unknown registry values and constraints fail closed.

## 15. Compatibility

Legacy `req.user.branchId` remains a temporary employee compatibility projection and must not be reused as delegated professional authority.

Delegated professional access must resolve through:

`User -> ExternalOrganizationMembership -> Assignment -> PermissionScope -> Business/Branch resource policy`

No compatibility fallback may silently convert an organization role or Assignment into broad Business access.

## 16. Explicit Non-Goals

This step does not implement:

- Prisma models or migrations
- Middleware or policy evaluators
- API endpoints
- Tax workspace
- Collaboration UI
- Document comments or tasks
- Approval workflow runtime
- Filing runtime
- Employee branch migration

## 17. Next Step

P1 Step 6 — Professional Access Prisma Foundation: implement additive data models and enums for Business, BusinessMembership, ExternalOrganization, ExternalOrganizationMembership, Assignment, and Permission Scope while preserving current Branch and Employee runtime compatibility.
