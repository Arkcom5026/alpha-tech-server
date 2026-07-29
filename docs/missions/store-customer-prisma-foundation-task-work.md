# Store Customer Prisma Foundation — Task Work Mission Pack

## Mission

Implement the additive Prisma foundation that separates platform identity from store-owned customer relationships, without migrating existing runtime consumers in this increment.

This mission is implementation-authorized only after reading:

- Issue #71 — Commerce Platform Foundation
- Draft PR #85 — Customer Platform / Store Architecture Authority
- `docs/increments/customer-platform-store-architecture-authority.md`

## Authority Decision

```text
Platform owns identity.
Store owns the customer relationship.
Transactions belong to the owning store.
Identity-to-store-customer links are explicit and verified.
```

## Increment Boundary

This increment owns only the persistence foundation required for future migration.

### In scope

- add new store-owned customer model(s)
- add explicit optional platform identity link model
- add required enums
- add relations on `Branch` and `User`
- add indexes and uniqueness constraints
- create one additive Prisma migration
- add focused contract verification
- run Prisma format, validate, generate, focused tests, and repository checks
- preserve all existing runtime models and relations

### Explicitly out of scope

- no deletion or rename of `CustomerProfile`
- no backfill of existing customer data
- no changes to Sales, Finance, Tax, Repair, Claim, Service, Device, Cart, OrderOnline, Reservation, or storefront runtime ownership
- no replacement of existing `customerId` fields
- no automatic account linking based only on matching phone or email
- no production migration execution
- no merge of PR #82 or PR #85
- no Anonymous Cart or OTP implementation
- no customer merge capability

## Required Prisma Direction

Use names that are clear and stable. The preferred foundation is:

```prisma
model StoreCustomer {
  id                Int      @id @default(autoincrement())
  branchId          Int
  displayName       String?
  phone             String?
  email             String?
  type              CustomerType @default(INDIVIDUAL)
  companyName       String?
  taxId             String?
  addressDetail     String?
  subdistrictCode   String?
  creditLimit       Decimal? @default(0) @db.Decimal(12, 2)
  paymentTerms      Int?
  internalNote      String?
  active            Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  branch            Branch   @relation(fields: [branchId], references: [id], onDelete: Restrict)
  subdistrict       Subdistrict? @relation(fields: [subdistrictCode], references: [code])
  identityLinks     StoreCustomerIdentityLink[]

  @@index([branchId, active])
  @@index([branchId, displayName])
  @@index([branchId, phone])
  @@index([branchId, email])
  @@index([branchId, taxId])
  @@index([subdistrictCode])
}
```

The exact field set may be adjusted only when current schema constraints require it. Any adjustment must preserve the ownership semantics and be documented in the PR.

Preferred identity link:

```prisma
model StoreCustomerIdentityLink {
  id              Int                             @id @default(autoincrement())
  storeCustomerId Int
  userId          Int
  status          StoreCustomerIdentityLinkStatus @default(PENDING)
  verificationMethod StoreCustomerIdentityVerificationMethod?
  requestedAt     DateTime                        @default(now())
  verifiedAt      DateTime?
  rejectedAt      DateTime?
  revokedAt       DateTime?
  createdAt       DateTime                        @default(now())
  updatedAt       DateTime                        @updatedAt

  storeCustomer   StoreCustomer @relation(fields: [storeCustomerId], references: [id], onDelete: Cascade)
  user            User          @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@unique([storeCustomerId, userId])
  @@index([userId, status])
  @@index([storeCustomerId, status])
}
```

Preferred enums:

```prisma
enum StoreCustomerIdentityLinkStatus {
  PENDING
  VERIFIED
  REJECTED
  REVOKED
}

enum StoreCustomerIdentityVerificationMethod {
  OTP
  AUTHENTICATED_SESSION
  STAFF_ASSISTED
  MIGRATION_REVIEW
}
```

`STAFF_ASSISTED` must not mean that staff may link identities unilaterally. It represents a future audited workflow and must not be used by runtime in this increment.

## Relation Requirements

Add additive reverse relations only:

```prisma
model User {
  // existing fields preserved
  storeCustomerIdentityLinks StoreCustomerIdentityLink[]
}

model Branch {
  // existing fields preserved
  storeCustomers StoreCustomer[]
}

model Subdistrict {
  // existing fields preserved
  storeCustomers StoreCustomer[]
}
```

Do not change the existing mandatory one-to-one relation between `User` and `CustomerProfile` in this increment.

## Data and Privacy Invariants

1. `StoreCustomer.branchId` is mandatory.
2. Store customer queries in future runtime must be scoped by actor-owned `branchId`; this increment establishes persistence only.
3. A `User` may link to StoreCustomers in multiple stores.
4. A StoreCustomer may exist without a linked User.
5. A User may exist without a StoreCustomer.
6. A phone/email match is never proof of ownership.
7. Stores must not discover links or customer records belonging to another store through platform identity.
8. Link state must be explicit and auditable.
9. Existing `CustomerProfile` remains the active legacy runtime model until later cutover increments.

## Uniqueness Rules

Do not create global uniqueness on StoreCustomer phone, email, tax ID, or display name.

Do not create branch-level uniqueness for phone or email in this foundation unless repository evidence proves the existing product requires one record only. Duplicate customer records are a future merge/review concern and must not block additive adoption.

The identity link pair must be unique:

```text
(storeCustomerId, userId)
```

Do not enforce one User per StoreCustomer globally beyond the explicit pair constraint unless an approved Product Decision is added.

## Migration Requirements

Create one new timestamped migration under `prisma/migrations/`.

Migration must be:

- additive
- non-destructive
- safe on an existing database
- free of data backfill
- free of changes to existing customer foreign keys
- reversible by dropping only the newly created tables/enums/indexes, although no destructive rollback command should be executed automatically

Migration must create enums before tables and must create foreign keys with the intended `Restrict`/`Cascade` behavior.

## Verification Requirements

Task Work must run and report exact results for:

```text
npx prisma format
npx prisma validate
npx prisma generate
npm test -- --runInBand (or repository-equivalent test command)
git diff --check
```

If the full test suite is too expensive or fails for unrelated baseline reasons, run a focused contract test and document the baseline failure precisely. Do not claim full Runtime PASS without successful evidence.

Add a focused contract test or verifier that confirms at minimum:

- `StoreCustomer` exists
- `branchId` is required
- StoreCustomer has Branch relation
- StoreCustomerIdentityLink exists
- User reverse relation exists
- identity link pair uniqueness exists
- no existing `CustomerProfile` model or relation was removed
- no existing runtime `customerId` field was changed in this increment

## Git Workflow

Working branch:

```text
agent/store-customer-prisma-foundation
```

Working Area must remain a Draft PR.

One increment equals one Draft PR.

Commit in intentional, reversible stages when practical:

1. Prisma additive foundation and migration
2. focused contract verification and mission evidence
3. targeted fixes from runtime evidence

Do not commit unrelated formatting or refactors.

## Required PR Record

The Draft PR description must contain:

- Scope / Mission
- Authority Chain
- Product Decision
- Files Changed
- Exact Prisma Delta
- Hybrid State Preserved
- Architecture Elevation
- Backward Compatibility
- Runtime Impact
- Migration Safety
- Verification
- Runtime Evidence
- Operational Impact
- Explicit Non-goals
- Remaining Risks
- Next Increment

## Evidence Output Required from Task Work

Return:

```text
Result: PASS / FAIL / PARTIAL
Branch:
Base SHA:
Head SHA:
Commit SHA(s):
Files changed:
Prisma models/enums added:
Migration path:
Commands executed:
Command results:
Focused tests:
Full tests:
Runtime impact:
Database impact:
Known baseline failures:
Remaining risks:
Next recommended action:
```

## Stop Conditions

Stop and report rather than widening scope if:

- active schema differs materially from the authority assumptions
- adding the models requires changing existing runtime foreign keys
- Prisma validation exposes unrelated schema breakage that cannot be isolated
- current main has advanced with a competing StoreCustomer model
- an existing active PR already owns the same Prisma models
- migration would require backfill or destructive changes
- model naming conflicts with current repository conventions

## Acceptance Criteria

This increment is complete only when:

1. the additive schema foundation exists
2. migration SQL exists and contains no destructive changes to legacy customer structures
3. Prisma format, validate, and generate pass
4. focused contract verification passes
5. repository diff contains no runtime cutover
6. existing `CustomerProfile` remains unchanged as runtime authority
7. Draft PR contains complete evidence
8. Runtime and Operational claims are limited to evidence actually obtained

## Next Increment After PASS

```text
Store Customer Backfill and Audit Foundation
```

That increment will analyze legacy CustomerProfile-to-branch relationships and produce an auditable candidate mapping. It must remain separate from Repair/Claim runtime cutover.