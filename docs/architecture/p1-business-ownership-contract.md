# P1 — Professional Access Foundation

## Step 2 — Business Ownership Contract

Status: Repository authority

This contract establishes the ownership model that future professional access and accounting-firm collaboration must follow.

## 1. Purpose

The platform must distinguish:

- the legal/operational business that owns data;
- the branches or locations operated by that business;
- users who hold membership in that business;
- employees assigned to one or more branches;
- external professional organizations that may later receive delegated access.

The current `Branch` model remains a compatibility structure during migration. It must not be interpreted as the final business owner aggregate.

## 2. Canonical hierarchy

```text
Business
├── Branch[]
├── BusinessMembership[]
└── ExternalOrganizationAssignment[]   (future Step 4)
```

A Business owns its operational and tax data. A Branch is a location or operating unit owned by exactly one Business.

## 3. Domain definitions

### Business

The first-class tenant and data owner.

Required identity:

- stable internal `businessId`;
- lifecycle state;
- legal/display identity;
- ownership and administrative membership;
- audit timestamps.

A Business may own one or many Branch records.

### Branch

A location or operational subdivision of one Business.

Rules:

- every migrated Branch must belong to exactly one Business;
- a Branch cannot be shared by multiple Businesses;
- Branch selection narrows operational scope but never changes Business ownership;
- Branch deletion or archival must not delete Business-owned historical records.

### BusinessMembership

The relationship granting a User standing inside a Business.

A membership is not equivalent to an employee record. It represents business-level authority and lifecycle.

Required concepts:

- `businessId`;
- `userId`;
- role;
- status;
- invitation/activation/revocation lifecycle;
- audit metadata.

### Employee branch assignment

Employee assignment is an operational projection under an active BusinessMembership.

A user may eventually be assigned to one or more Branch records, but those Branch records must belong to the same Business as the membership.

The current `EmployeeProfile.branchId` remains a temporary single-branch compatibility projection until a later migration increment replaces it.

## 4. Role separation

Platform roles and Business roles must remain separate.

### Platform authority

Examples:

- `SUPERADMIN`
- infrastructure or support operators

Platform authority does not implicitly create Business ownership.

### Business authority

Canonical roles for the foundation:

- `OWNER` — ultimate business authority and delegation control;
- `ADMIN` — business administration without ownership transfer;
- `MANAGER` — operational management within granted scope;
- `STAFF` — operational access within granted scope;
- `VIEWER` — read-only access where explicitly permitted.

Future external-accounting roles must not be embedded into this membership enum. They belong to External Organization assignment and Permission Scope steps.

## 5. Ownership invariants

1. Business is the first-class tenant and data owner.
2. Every Branch belongs to exactly one Business after migration.
3. A User gains Business authority only through an active BusinessMembership or explicit platform override.
4. A client-provided `businessId` or `branchId` is a selector, never authorization evidence.
5. Request authority must be revalidated against current database state.
6. Cross-Business access is denied by default.
7. Cross-Branch access inside one Business requires explicit scope.
8. Business ownership cannot be inferred only from legacy `EmployeeProfile.branchId`.
9. External organizations receive delegated access; they never become owners of the client Business data.
10. Revocation must remove future access without erasing historical audit evidence.

## 6. Lifecycle

### Business

```text
ACTIVE → SUSPENDED → ARCHIVED
```

- `ACTIVE`: normal operations permitted.
- `SUSPENDED`: access restricted according to platform policy; historical data retained.
- `ARCHIVED`: no new operations; history retained.

### BusinessMembership

```text
INVITED → ACTIVE → SUSPENDED → REVOKED
```

Rules:

- only `ACTIVE` membership grants normal Business authority;
- `REVOKED` is terminal for that membership record;
- reinvitation creates a new auditable membership lifecycle rather than rewriting history;
- the final active `OWNER` cannot be revoked without ownership transfer or an explicit guarded recovery process.

## 7. Request authority contract

Future request context must distinguish identity, business, and branch scope.

```js
req.auth = {
  userId,
  platformRole,
  businessId,
  businessMembershipId,
  businessRole,
  branchIds,
  activeBranchId,
  authoritySource,
};
```

Rules:

- `businessId` comes from database-revalidated authority;
- `activeBranchId` must belong to `businessId`;
- `branchIds` represents granted branch scope, not every branch in the Business;
- route parameters and request bodies must be checked against this authority context;
- legacy `req.user.branchId` remains compatibility-only until a dedicated runtime migration.

## 8. Compatibility strategy

Migration must be additive and reversible.

1. Introduce Business and BusinessMembership foundations without deleting Branch relations.
2. Backfill one Business for each currently independent legacy Branch grouping according to an approved migration rule.
3. Attach Branch to Business.
4. Project existing employee access into BusinessMembership and branch assignment structures.
5. Add database-revalidated request authority.
6. Migrate modules incrementally from `req.user.branchId` to Business + Branch scope.
7. Remove legacy compatibility fields only after no runtime reference remains and final user testing passes.

No step may silently broaden access.

## 9. Data ownership guidance

New business-owned records should prefer an explicit `businessId` even when also branch-scoped.

Classification:

- Business-level data: `businessId` required, `branchId` optional.
- Branch-operational data: both `businessId` and `branchId` required.
- Platform reference data: neither Business nor Branch ownership unless explicitly overridden.
- External collaboration data: owner `businessId` plus delegated organization assignment reference.

Existing branch-only records will be migrated by later domain-specific increments.

## 10. Explicit non-goals

This step does not:

- modify Prisma;
- create migrations;
- alter `verifyToken`;
- change routes, controllers, services, or repositories;
- grant external accounting access;
- define detailed permission scopes;
- migrate employee access;
- change frontend behavior.

## 11. Approved next step

P1 Step 3 — External Organization Foundation.

That step may define the accounting-firm organization aggregate and its own membership lifecycle, but it must not assign any client Business or grant access yet.
