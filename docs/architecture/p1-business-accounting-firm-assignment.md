# P1 Step 4 — Business-to-Accounting-Firm Assignment

## Status

Repository authority for the relationship between a client Business and an accounting firm.

This step defines consent, assignment lifecycle, effective periods, revocation, and audit evidence. It does **not** grant permission to read, review, edit, file, export, or otherwise operate on Business data. Permission is defined separately in P1 Step 5.

## 1. Purpose

A Business owns its data. An accounting firm may act only when the Business explicitly creates and maintains an assignment to that firm.

The assignment answers only:

> Which accounting firm has an active professional relationship with this Business?

It does not answer:

> Which modules, documents, periods, branches, actions, or tax operations may the firm access?

## 2. Aggregate

```text
BusinessAccountingFirmAssignment
├── businessId
├── externalOrganizationId
├── status
├── effectiveFrom
├── effectiveUntil
├── requestedByBusinessMembershipId
├── acceptedByOrganizationMembershipId?
├── activatedAt?
├── revokedAt?
├── revokedByBusinessMembershipId?
├── revocationReason?
└── audit metadata
```

The assigned organization must be an active `ExternalOrganization` of type `ACCOUNTING_FIRM`.

## 3. Ownership and consent

- The Business remains the sole owner of all Business data.
- Assignment creation requires authority from the Business side.
- An accounting firm cannot unilaterally attach itself to a Business.
- Organization acceptance may be required before activation.
- Business revocation does not require organization approval.
- Platform administrators may perform exceptional administrative repair only through explicit, auditable platform authority.

## 4. Lifecycle

Assignment statuses:

```text
PENDING_ACCEPTANCE
ACTIVE
SUSPENDED
REVOKED
EXPIRED
DECLINED
```

Allowed lifecycle:

```text
PENDING_ACCEPTANCE -> ACTIVE
PENDING_ACCEPTANCE -> DECLINED
PENDING_ACCEPTANCE -> REVOKED
ACTIVE -> SUSPENDED
ACTIVE -> REVOKED
ACTIVE -> EXPIRED
SUSPENDED -> ACTIVE
SUSPENDED -> REVOKED
SUSPENDED -> EXPIRED
```

Terminal states:

```text
REVOKED
EXPIRED
DECLINED
```

A terminal assignment is never reactivated. A new relationship requires a new assignment record.

## 5. Effective period

An assignment is effective only when all conditions are true:

- `status === ACTIVE`
- `effectiveFrom <= now`
- `effectiveUntil` is null or `now < effectiveUntil`
- Business is active
- External Organization is active
- required organization acceptance exists

Dates cannot override status. Status cannot override dates.

## 6. Assignment does not grant permission

An active assignment creates relationship eligibility only.

It grants none of the following by itself:

- Business overview access
- Branch access
- Tax document read access
- Tax document mutation access
- Filing access
- Export access
- Collaboration access
- Customer, supplier, sale, purchase, payment, inventory, repair, claim, or employee access

Effective access requires both:

```text
ACTIVE Assignment
AND
ACTIVE Permission Scope
```

Absence of either means deny.

## 7. Cardinality

Initial policy:

- A Business may have multiple historical assignments.
- At most one effective active assignment per Business and organization pair.
- A Business may assign more than one accounting firm only when product policy explicitly permits it.
- The initial implementation should default to one primary active accounting firm per Business.
- No uniqueness rule may delete or overwrite historical assignments.

## 8. Business-side authority

The following Business roles may create or revoke an assignment:

```text
OWNER
ADMIN
```

`MANAGER`, `STAFF`, and `VIEWER` cannot create or revoke an accounting-firm assignment by default.

Business authorization must be database-revalidated and must not trust client-supplied role or membership data.

## 9. Organization-side authority

The following organization roles may accept or decline an assignment:

```text
OWNER
ADMIN
```

`PROFESSIONAL`, `ASSISTANT`, and `VIEWER` cannot accept an organization-wide assignment by default.

Organization acceptance proves relationship acceptance only. It does not create client-data permission.

## 10. Request authority

Client identifiers are selectors only:

```text
businessId
externalOrganizationId
assignmentId
```

The server must revalidate:

- authenticated User
- active Business membership
- Business role
- active External Organization membership when organization action is requested
- Organization role
- Assignment ownership
- Assignment lifecycle state
- Effective period

An assignment from Business A must never authorize Business B.

## 11. Revocation

Business revocation is immediately authoritative.

After revocation:

- effective delegated access becomes zero
- permission scopes become ineffective even if their rows remain
- active sessions must revalidate before protected operations
- historical reviews and audit records remain attributable
- assignment and permission history must not be physically deleted as a normal revocation action

Revocation metadata must include:

```text
revokedAt
revokedByUserId
revokedByBusinessMembershipId
revocationReason?
```

## 12. Suspension

Suspension is temporary and auditable.

A suspended assignment:

- grants no effective access
- preserves relationship history
- may return to ACTIVE only if non-terminal and all authority conditions are valid

Organization suspension or closure makes the assignment ineffective without mutating ownership of the assignment record.

## 13. Expiration

When `effectiveUntil` is reached, effective access ends automatically.

The durable status may be normalized to `EXPIRED` by a command, scheduled process, or read-time projection. Regardless of implementation, authorization must deny access after the effective end time.

## 14. Audit events

Required assignment events:

```text
ASSIGNMENT_REQUESTED
ASSIGNMENT_ACCEPTED
ASSIGNMENT_DECLINED
ASSIGNMENT_ACTIVATED
ASSIGNMENT_SUSPENDED
ASSIGNMENT_RESUMED
ASSIGNMENT_REVOKED
ASSIGNMENT_EXPIRED
```

Each event must preserve:

- Business identity
- External Organization identity
- Assignment identity
- actor User identity
- actor authority source
- prior status
- resulting status
- timestamp
- correlation or request identifier when available
- reason or note when applicable

## 15. Data isolation invariants

- Business owns the assignment from the client-consent perspective.
- External Organization does not own client Business data.
- Assignment never implies permission.
- Permission never survives ineffective assignment.
- Cross-Business access is denied by default.
- Cross-Organization use of an assignment is denied.
- Branch scope cannot exceed the assigned Business.
- Revocation is fail-closed.
- Missing, ambiguous, duplicated, expired, suspended, or terminal authority is denied.

## 16. Compatibility

This contract adds no runtime projection yet.

Future implementation may expose:

```js
req.auth.delegation = {
  assignmentId,
  externalOrganizationId,
  externalOrganizationMembershipId,
  assignmentStatus,
  effectiveFrom,
  effectiveUntil,
  permissionScopeIds,
};
```

The existence of this object must never be inferred solely from request payload data.

## 17. Explicit non-goals

This step does not define:

- Prisma models or migrations
- assignment endpoints
- invitation delivery
- permission resources or actions
- branch-level grants
- tax workspace
- document collaboration
- filing authority
- frontend screens

## 18. Next step

P1 Step 5 — Permission Scope defines the exact resources, actions, branches, periods, constraints, and grant lifecycle that may become effective only through an active assignment.
