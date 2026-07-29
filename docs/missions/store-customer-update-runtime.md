# Store Customer Update Runtime — Execution Mission

## Mission

Move only the authenticated staff update path `PUT /api/customers/:id` from legacy `CustomerProfile` mutation to branch-owned `StoreCustomer` mutation.

## Parent Authority

This increment is stacked on:

```text
agent/store-customer-create-runtime
```

Search, Create, and Update remain independently reviewable and reversible.

## Authorized Runtime Surface

```text
PUT /api/customers/:id
```

## Required Behavior

1. Require authenticated user context and a valid `branchId`.
2. Preserve current staff role authorization.
3. Resolve the target only through `StoreCustomer` with `id`, authenticated `branchId`, and `active: true`.
4. Never update a customer relationship owned by another branch.
5. Update StoreCustomer-owned fields only.
6. Phone changes update `StoreCustomer.phone`; they must not mutate `User.loginId`.
7. Preserve customer type and Subdistrict/Postcode validation.
8. Preserve the existing JSON response fields where StoreCustomer has source data.
9. Use explicit compatibility value `creditBalance: 0`.
10. Do not change `PUT /api/customers/me` in this increment.

## Explicit Non-goals

- `/api/customers/me` cutover
- Platform User mutation
- CustomerProfile mutation
- Identity linking
- Backfill execution
- Consumer cutover
- Prisma schema or migration changes
- Frontend changes
- Production deployment

## Verification Boundary

Repository verification may prove source authority and scope. Runtime and Operational PASS require separate executable evidence.
