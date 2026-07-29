# Store-Scoped Customer Search Runtime — Execution Mission

## Mission

Change only the authenticated branch customer-search read paths so customer lookup is backed by `StoreCustomer` and is always restricted to the authenticated branch.

## Production Baseline

```text
8ad9652a8e6c6cccea662c3734abec9a8b80511d
```

This branch is rebuilt from the post-migration production baseline. No legacy customer controller or route may be restored.

## Authorized Runtime Surface

```text
GET /api/customers/by-phone/:phone
GET /api/customers/by-name?q=
```

## Required Behavior

1. Require a valid `req.user.branchId` before querying.
2. Query `prisma.storeCustomer` for the two authorized endpoints.
3. Include `branchId` and `active: true` in every search predicate.
4. Phone lookup uses normalized `StoreCustomer.phone`.
5. Name lookup uses `StoreCustomer.displayName`.
6. Preserve the existing JSON response fields where StoreCustomer has corresponding data.
7. Use an explicit compatibility value for `creditBalance`; do not query CustomerProfile.
8. Never fall back to `CustomerProfile` for these endpoints.
9. Do not change `/api/customers/me`, create, or update behavior.

## Explicit Non-goals

- customer create/update cutover
- `/api/customers/me` cutover
- identity linking
- backfill execution
- Repair/Claim/Sales/Service/POS consumer cutover
- frontend changes
- Prisma schema or migration changes
- production deployment

## Verification Boundary

Repository verification may prove source-level authority and scope. Runtime and Operational PASS require separate executable evidence.
