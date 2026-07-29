# Customer Platform / Store Architecture Authority

## Mission

Establish the approved customer ownership boundary for Alpha-Tech before any Prisma migration or runtime rewrite begins.

This increment is an architecture and execution-authority record. It does not change Prisma, migrations, API behavior, or production runtime.

## Repository Evidence

The active schema currently combines two responsibilities in `CustomerProfile`:

1. platform/account-linked profile through mandatory unique `userId`
2. operational customer record used by store-owned transactions

At the same time, operational records such as `Sale`, `RepairJob`, `CustomerReceipt`, `CustomerDeposit`, `ServiceOrder`, `OrderOnline`, and `PosHeldCart` carry their own `branchId` while referencing the global `CustomerProfile`.

This creates an implicit model:

```text
CustomerProfile = global
Store transactions = branch-owned
Customer visibility = often inferred through branch-owned transactions
```

That inference fails when a workflow searches `CustomerProfile` directly without a product, sale, repair, or other branch-owned document as a filter.

## Approved Product Decision

```text
Platform owns identity.
Store owns the customer relationship.
Transactions belong to the owning store.
Links between identity and store customer are explicit and verified.
```

Canonical model:

```text
One Platform Identity
→ zero or many verified Store Customer relationships
→ strictly store-owned transactions
```

## Authority Boundaries

### Platform Identity Authority

Platform-owned data includes:

- login account and authentication credentials
- verified phone/email ownership
- OTP and account recovery authority
- platform sessions and security state
- platform profile preferences
- anonymous-shopping-session binding after identity verification
- platform-level consent

A platform identity may exist without being a customer of any store.

### Store Customer Authority

Store-owned data includes:

- customer display name used by the store
- store-recorded contact details
- tax and billing data used by that store
- credit limit, payment terms, and debt context
- store notes, categorization, and relationship state
- store-specific consent and marketing state
- sales, deposits, receipts, repair, claim, service, and related history

A store customer may exist without a platform account.

### Transaction Authority

Every store transaction must remain explicitly scoped by its owning `branchId` or future business/store authority identifier. Transaction authorization must never be derived solely from a global customer identifier.

## Target Domain Direction

The target architecture must separate the current mixed responsibilities into concepts equivalent to:

```text
User / CustomerIdentity
PlatformCustomerProfile (optional platform-owned profile)
StoreCustomer (required store ownership)
StoreCustomerIdentityLink (optional verified binding)
```

Final Prisma names remain subject to the Prisma Foundation increment, but the ownership semantics in this document are authoritative.

## Required Lifecycle States

The architecture must support all of these states:

1. anonymous visitor with no account and no store customer
2. verified platform identity with no store relationship
3. store customer with no platform identity
4. verified identity linked to one store customer
5. one verified identity linked independently to multiple stores
6. unverified candidate match awaiting confirmation
7. rejected, revoked, or conflict-reviewed identity link

## Linking Rules

- Matching phone or email is not sufficient to create a link automatically.
- A match may create a candidate only.
- Final binding requires verified identity evidence such as OTP or another approved method.
- A store must not see another store's customer relationship or transaction history through platform identity.
- Updating platform profile data must not silently overwrite store-owned customer data.
- Updating store-owned customer data must not modify platform identity data.

## Source-of-Truth Rules

| Data | Authority |
|---|---|
| Login phone/email | Platform Identity |
| OTP verification | Platform Identity |
| Platform display profile | Platform Profile |
| Store-facing customer name | StoreCustomer |
| Tax invoice identity/address | Store-owned tax/billing profile or transaction snapshot |
| Credit limit and payment terms | StoreCustomer |
| Outstanding debt | Store-owned transactions/ledger |
| Sales, repair, claim, deposit, receipt history | Owning store transaction |
| Platform marketing consent | Platform consent |
| Store marketing consent | Store consent |

## Compatibility Constraints

- Existing `CustomerProfile` runtime must remain operational until an additive migration and module-by-module cutover are certified.
- No destructive rename, relation removal, or data deletion is authorized in the first Prisma increment.
- Historical documents must retain their original store ownership and auditable customer data.
- PR #82 remains a transitional repair-isolation layer; inferred customer visibility must not become the permanent cross-module ownership model.
- Sales, Finance, Tax, Repair, Claim, Service, Device, Deposit, Online Order, and Held Cart must migrate in bounded increments rather than one global rewrite.

## Planned Increment Sequence

### Increment 1 — Architecture Authority

This document. Repository-only. No runtime impact.

### Increment 2 — Additive Prisma Foundation

Add store-customer and identity-link persistence without migrating existing runtime ownership.

Required evidence:

- Prisma format PASS
- Prisma validate PASS
- Prisma generate PASS
- additive migration inspection
- no destructive SQL
- focused contract tests

### Increment 3 — Backfill and Audit Foundation

Create store-customer candidates from existing branch-owned transaction relationships. Produce an audit report for:

- customers referenced by one store
- customers referenced by multiple stores
- customers with no branch-owned relationship
- duplicate phone/email candidates
- orphan or inconsistent relations

No legacy deletion is allowed.

### Increment 4 — Repair / Claim Cutover

Move repair, claim, device intake, and their customer searches to explicit store-customer ownership. Replace PR #82 inferred compatibility logic after operational certification.

### Increment 5 — Sales / Customer Operations Cutover

Move sale creation, held carts, customer search, deposits, quotations, and related workflows.

### Increment 6 — Finance / Tax Cutover

Move customer receipts, allocations, billing, debt, and tax-document customer ownership while preserving historical auditability.

### Increment 7 — Platform Identity at Commitment

Bind anonymous shopping session and verified platform identity to the selected store customer through explicit verified linking.

### Increment 8 — Legacy Retirement

Retire mixed/global customer runtime only after repository, runtime, operational, and data-audit gates pass across all migrated modules.

## Task Work Mission Boundary

Task Work is the runtime and Prisma executor for this agenda. Each Task Work invocation must receive a narrow mission pack and must not redesign the approved ownership model.

The first authorized Task Work mission is limited to:

```text
Additive Store Customer Prisma Foundation
```

It must not:

- migrate Sales, Finance, Tax, Repair, or Claim runtime
- delete or rename `CustomerProfile`
- backfill production data
- introduce automatic phone/email linking
- merge PR #82
- broaden into anonymous cart or reservation implementation

## Verification Gates

### Repository Gate

- architecture authority recorded
- ownership boundaries unambiguous
- compatibility constraints explicit
- increment sequence defined
- Task Work scope bounded

### Runtime Gate

Not applicable to this architecture-only increment.

### Operational Gate

Not applicable to this architecture-only increment.

## Current Status

```text
Architecture Authority: APPROVED
Repository Evidence: CONFIRMED
Prisma Change: NOT STARTED
Runtime Impact: NONE
Production Impact: NONE
Next Authorized Increment: Additive Store Customer Prisma Foundation
```
