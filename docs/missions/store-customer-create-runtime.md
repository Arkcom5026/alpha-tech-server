# Store Customer Create Runtime — Execution Mission

## Mission

Move only `POST /api/customers` from global `CustomerProfile` creation to branch-owned `StoreCustomer` creation.

## Parent

```text
PR #109 — Store-Scoped Customer Search Runtime v2
agent/store-scoped-customer-search-runtime-v2
```

This increment is intentionally stacked so Search and Create remain independently reviewable.

## Required Behavior

1. Require a valid authenticated `req.user.branchId`.
2. Normalize and validate the 10-digit phone number.
3. Search for an existing active StoreCustomer only inside the authenticated branch.
4. Return that existing StoreCustomer with the current response contract when found.
5. Create `StoreCustomer` with mandatory `branchId` when no same-branch active record exists.
6. Validate Subdistrict and Postcode exactly as the current HTTP contract requires.
7. Preserve response fields where StoreCustomer provides corresponding data.
8. Use explicit `creditBalance: 0` compatibility projection.
9. Do not create or mutate `User`.
10. Do not create `CustomerProfile`.
11. Do not hash or assign an initial password.
12. Do not create `StoreCustomerIdentityLink` from phone or email equality.

## Product Boundary

```text
Platform owns identity.
Store owns the customer relationship.
Phone/email equality is not identity proof.
```

A store employee creating a customer record establishes only a branch-owned commercial relationship. Account registration and identity linking remain separate future commitments.

## Explicit Non-goals

- customer update cutover
- `/api/customers/me` cutover
- account registration
- OTP or identity verification
- StoreCustomerIdentityLink creation
- legacy backfill execution
- Repair/Claim/Sales/Service/POS consumer cutover
- Prisma schema or migration changes
- frontend changes
- production deployment

## Verification Boundary

Repository verification may establish scope, source-level authority, and compatibility intent. Runtime and Operational PASS require separate executable evidence.