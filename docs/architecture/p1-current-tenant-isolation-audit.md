# P1 — Current Tenant Isolation Audit

## Status

- Agenda: Professional Access Foundation
- Step: P1 Step 1 — Current Tenant Isolation Audit
- Classification: Repository audit and architecture contract
- Runtime behavior change: None
- Prisma change: None
- API change: None
- Authorization change: None
- Runtime and operational testing: Deferred to the repository owner after the complete agenda

## Purpose

Establish an evidence-based map of the current ownership, branch isolation, request authority, and access model before introducing a professional tenant foundation.

This step does **not** create a tenant model and does **not** claim that `Branch` is already a tenant. It records the current system faithfully so later increments can change it safely.

## Current Authority Model

### Identity

`User` is the login authority. The current model contains no direct `tenantId`, `businessId`, or store-ownership relation on `User`.

### Employee access

`EmployeeProfile` is a one-to-one employee projection for a `User`. It contains one nullable `branchId` and therefore represents, at most, one active branch assignment in the current schema.

### Branch

`Branch` currently carries several responsibilities at once:

1. Store or physical location information
2. Business configuration such as business type and feature settings
3. Employee assignment boundary
4. Operational data partition key across many models
5. Tax and document identity fields
6. In some flows, the practical access boundary

These responsibilities must not be interpreted as proof that `Branch` is the future Tenant aggregate.

### Request authority

`verifyToken` validates JWT authenticity and then reloads current `User` and `EmployeeProfile` state from the database.

For an employee request, current request authority includes:

- `user.id`
- normalized user role
- employee profile identity
- employee lifecycle state
- employee role
- `employeeProfile.branchId` projected as `req.user.branchId`

There is currently no separately resolved Tenant identity in `req.user`.

## Current Isolation Categories

Every backend flow that handles branch-owned data must be classified into one of the following categories.

### A. Server-derived branch authority

The flow derives branch scope only from authenticated database authority, normally `req.user.branchId`, and does not trust a client-selected branch as ownership authority.

This is the strongest current pattern, but it remains branch isolation rather than tenant isolation.

### B. Client branch with server revalidation

The client sends a branch identifier, but the server verifies that the authenticated actor is authorized for that branch before reading or mutating data.

This can support explicit branch selection later, provided the revalidation authority becomes membership-based rather than relying on one employee branch field.

### C. Client branch without ownership revalidation

The flow accepts `branchId` from params, query, or body and uses it without proving that the authenticated actor may access that branch.

This is a cross-branch exposure risk and must be remediated in a later targeted increment.

### D. Unscoped branch-owned query

The flow reads or mutates data that belongs to a branch but omits a branch predicate or ownership relation entirely.

This is a high-priority isolation risk.

### E. Public or platform-global data

The flow is intentionally public or global and does not expose private branch-owned operational data.

Public classification must be explicit. A route is not public merely because authentication middleware is absent.

## Confirmed Architectural Findings

1. Current tenancy is branch-centric, but a first-class Tenant or Business aggregate does not yet exist.
2. Authentication lifecycle authority is revalidated against the database on every verified request.
3. Employee branch authority is currently single-branch and nullable.
4. `Branch` is referenced broadly across operational, stock, sales, purchase, tax, repair, claim, supplier, and service domains.
5. A future Tenant foundation must preserve current branch-owned records while separating business ownership from physical or operational branch identity.
6. `req.user.branchId` is a current compatibility authority, not a permanent multi-tenant contract.
7. No module may infer cross-branch permission from an administrator-like role alone unless an explicit platform or tenant policy grants it.
8. `SUPERADMIN` must remain distinguishable from tenant administration. Platform authority and tenant authority are separate concerns.

## Required Audit Record Per Module

Each module reviewed after this foundation must record:

- Module and route surface
- Authentication middleware
- Source of branch identifier
- Whether branch ownership is revalidated
- Read predicates
- Mutation predicates
- Related-record validation
- Cross-branch exposure risk
- Public/global justification, when applicable
- Required remediation increment
- Compatibility impact

## Target Domain Direction

The intended direction is:

```text
Business / Tenant
├── Tenant Membership
│   ├── Owner
│   ├── Administrator
│   └── Employee or operator access
└── Branch / Store Location
    ├── Branch membership or assignment
    └── Branch-owned operational records
```

This diagram is a direction contract, not authorization to add Prisma models in this audit step.

## Invariants For Later Increments

1. Every private operational record must resolve to exactly one Tenant, directly or through an owned Branch.
2. A Branch must belong to exactly one Tenant.
3. Tenant access must be proven from current database membership, not solely from JWT claims.
4. Branch access must be proven within the resolved Tenant.
5. Client-provided tenant or branch identifiers are selectors, never authority by themselves.
6. Cross-tenant access is denied by default.
7. Platform-level administration must be explicit, auditable, and separate from tenant membership.
8. Existing branch-based API contracts must be migrated incrementally with documented compatibility behavior.
9. No broad tenant remediation may be bundled into an unrelated business feature.
10. Runtime and operational PASS may only be declared from executed evidence.

## Risk Register

### TIA-001 — No first-class Tenant owner

**Risk:** Branches and branch-owned data cannot be grouped under an explicit business owner.

**Consequence:** A multi-store business, tenant administration, ownership transfer, and tenant-wide reporting lack a stable authority root.

### TIA-002 — Single employee branch projection

**Risk:** `EmployeeProfile.branchId` cannot represent one employee working across several authorized branches.

**Consequence:** Branch switching may become client-driven or role-driven without a durable membership authority.

### TIA-003 — Branch as overloaded aggregate

**Risk:** Store identity, business settings, tax identity, data partitioning, and access boundary are combined.

**Consequence:** Future migration may accidentally change business behavior while attempting to establish tenancy.

### TIA-004 — Client-selected branch exposure

**Risk:** Existing flows may accept branch identifiers from request input without server ownership validation.

**Consequence:** Authenticated users may read or mutate another branch's data.

### TIA-005 — Unscoped related-record access

**Risk:** A top-level branch predicate may exist while related entities are loaded only by global ID.

**Consequence:** Cross-branch association or mutation can occur inside an apparently scoped operation.

### TIA-006 — Platform and tenant administration ambiguity

**Risk:** Broad roles such as `ADMIN` or `SUPERADMIN` may be interpreted inconsistently.

**Consequence:** Tenant boundaries can be bypassed accidentally.

## Increment Plan

### P1 Step 1 — Current Tenant Isolation Audit

Repository-only audit, classification contract, risk register, and verifier. No runtime behavior changes.

### P1 Step 2 — Tenant Domain Contract

Define Tenant, TenantMembership, Branch ownership, role separation, lifecycle rules, compatibility rules, and API authority contract before schema implementation.

### P1 Step 3 — Prisma Tenant Foundation

Add the minimum durable Tenant and membership foundation with an explicit backfill strategy. Do not change business flow behavior in the same increment.

### P1 Step 4 — Request Access Context

Resolve current tenant and authorized branches from database authority and expose a stable request access context while retaining documented compatibility fields.

### P1 Step 5 onward — Module Isolation Remediation

Remediate modules in bounded increments, prioritizing high-risk branch-owned reads and mutations. Each increment must preserve API behavior where practical and identify any intentional contract change.

## Completion Decision

P1 Step 1 is complete at Repository Gate when:

- This audit authority is present.
- The machine-readable contract is present.
- The repository verifier validates the authority files and required invariants.
- No Prisma, runtime route, authorization middleware, or business module behavior is changed.

CI is supplementary and non-blocking for agenda continuation. Runtime and operational verification remain deferred to the repository owner's final test cycle.