# P1 — External Organization Foundation

## Status

- Blueprint: P1 — Professional Access Foundation
- Step: 3 of 7
- Increment type: Architecture and domain contract
- Runtime impact: None
- Prisma impact: None
- Depends on:
  - Step 1 — Current Tenant Isolation Audit
  - Step 2 — Business Ownership Contract

## Mission

Define a first-class external professional organization that can represent an accounting firm or another approved professional service organization without granting it ownership of, or access to, any client Business data.

This step establishes organization identity, organization membership, internal roles, lifecycle, and audit invariants only. Business assignment and delegated client access belong to later increments.

## Core Boundary

```text
Business                            ExternalOrganization
(data owner / tenant)               (professional service organization)
├── Branch[]                        └── ExternalOrganizationMembership[]
└── BusinessMembership[]

No relationship or data access exists between them in Step 3.
```

An External Organization is not:

- a Business tenant,
- a Branch,
- a platform administrator,
- an owner of client tax or accounting records,
- an implicit delegate for every Business,
- an authorization shortcut based on email domain or profession.

## Aggregate: ExternalOrganization

### Purpose

Represents an independently managed professional organization such as:

- an accounting firm,
- an audit firm,
- a tax advisory firm,
- another professional organization explicitly supported in the future.

### Proposed identity fields

```text
ExternalOrganization
- id
- organizationType
- legalName
- displayName
- registrationNumber?
- taxId?
- status
- createdAt
- updatedAt
- suspendedAt?
- closedAt?
```

### Organization types

Initial supported values:

- `ACCOUNTING_FIRM`

Future types may be introduced through explicit increments. A free-form organization type must not silently acquire access semantics.

### Organization lifecycle

```text
PENDING
  -> ACTIVE
  -> SUSPENDED
  -> ACTIVE
  -> CLOSED
```

Rules:

- `PENDING` organizations cannot exercise professional access.
- `ACTIVE` means the organization itself is valid; it does not mean it can access any Business.
- `SUSPENDED` disables all effective delegated access for all members while preserving records.
- `CLOSED` is terminal for normal operation.
- Status transitions require actor and timestamp evidence.

## Aggregate: ExternalOrganizationMembership

### Purpose

Associates a User with an External Organization and defines authority inside that organization only.

```text
ExternalOrganizationMembership
- id
- externalOrganizationId
- userId
- role
- status
- invitedAt?
- acceptedAt?
- activatedAt?
- suspendedAt?
- revokedAt?
- createdAt
- updatedAt
```

### Membership roles

- `OWNER`
- `ADMIN`
- `PROFESSIONAL`
- `ASSISTANT`
- `VIEWER`

Role meanings:

- `OWNER`: accountable organization owner; may manage organization lifecycle and membership.
- `ADMIN`: may manage organization profile and membership within granted policy.
- `PROFESSIONAL`: may perform delegated professional work only after a separate Business assignment and permission grant exist.
- `ASSISTANT`: limited support role; receives no client access by default.
- `VIEWER`: organization-internal read role; receives no client access by default.

No role in this list grants Business access by itself.

### Membership lifecycle

```text
INVITED
  -> ACTIVE
  -> SUSPENDED
  -> ACTIVE
  -> REVOKED
```

Rules:

- Membership is unique per `externalOrganizationId + userId` for the active logical record.
- `INVITED` is not active authority.
- `ACTIVE` grants organization-internal authority only.
- `SUSPENDED` removes effective authority without deleting history.
- `REVOKED` is terminal for that membership record.
- Rejoining requires a new auditable lifecycle according to the future persistence contract.

## Authority Boundaries

### Organization-internal authority

An active membership may authorize actions such as:

- view the organization profile,
- manage organization members according to role,
- prepare for later Business assignments,
- view organization-owned audit records.

### Explicitly forbidden in Step 3

An External Organization or membership must not:

- query Business data,
- query Branch operational data,
- read tax documents,
- modify tax documents,
- file taxes for a Business,
- access sales, purchases, stock, repair, customer, or supplier data,
- derive Business access from matching email, tax ID, phone, or organization type,
- assume access because a User is also a Business member elsewhere.

## Separation of Authorities

```text
Platform Authority
  != Business Authority
  != External Organization Authority
  != Delegated Professional Authority
```

A User may hold more than one membership, but each authority must be independently resolved from current database state.

Example:

```text
User A
├── BusinessMembership: STAFF at Business X
└── ExternalOrganizationMembership: PROFESSIONAL at Firm Y
```

These roles do not combine automatically. Firm Y still cannot access Business X until Step 4 creates an explicit assignment, and later permission scopes authorize concrete actions.

## Request Authority Projection

Future authentication may expose organization context separately from Business context:

```js
req.auth = {
  userId,
  platformRole,
  businessContext: null,
  externalOrganizationContext: {
    externalOrganizationId,
    membershipId,
    role,
    status,
  },
};
```

Rules:

- Organization identifiers supplied by the client are selectors only.
- Membership must be revalidated from the database.
- Organization status and membership status must both be active.
- The projection must not include Business authority unless independently resolved.

## Audit Requirements

The following events must be preserved conceptually for future implementation:

- organization created,
- organization activated,
- organization suspended,
- organization reactivated,
- organization closed,
- member invited,
- invitation accepted,
- member activated,
- role changed,
- member suspended,
- member reactivated,
- member revoked.

Each event requires:

- actor identity,
- target organization,
- target membership when applicable,
- previous state,
- next state,
- timestamp,
- correlation or request identifier when available.

## Data Ownership

External Organization-owned data includes only its own:

- organization profile,
- organization membership records,
- organization lifecycle evidence,
- organization-internal audit records.

Client Business data remains owned by the Business even when professional access is later delegated.

## Compatibility Strategy

Step 3 introduces no compatibility projection into `req.user`, `EmployeeProfile`, or existing Branch flows.

Future implementation order:

1. Add Prisma organization and membership models.
2. Create organization lifecycle services.
3. Create membership lifecycle services.
4. Add database-revalidated organization context projection.
5. Preserve isolation from Business data.
6. Introduce Business assignment only in Step 4.

## Invariants

1. External Organization is never the owner of client Business data.
2. Organization activation alone grants no Business access.
3. Active organization membership grants organization-internal authority only.
4. Business access requires a separate explicit assignment.
5. Client-provided organization IDs are selectors, not authority.
6. Organization and membership state must be database-revalidated.
7. Suspended or closed organizations have no effective delegated access.
8. Suspended or revoked memberships have no effective authority.
9. Revocation and closure preserve historical audit evidence.
10. Platform, Business, organization, and delegated authority remain separate.

## Explicit Non-Goals

This step does not define or implement:

- Business-to-accounting-firm assignment,
- Branch assignment,
- permission scopes,
- tax review workspace,
- tax collaboration,
- Prisma models or migrations,
- runtime middleware,
- routes or APIs,
- frontend surfaces.

## Next Step

P1 Step 4 — Business-to-Accounting-Firm Assignment:

- explicit Business owner consent,
- assignment lifecycle,
- effective dates,
- revocation,
- organization assignment without permissions by default,
- audit evidence for every relationship transition.
