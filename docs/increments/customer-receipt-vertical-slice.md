# Customer Receipt Vertical Slice

## Mission

Migrate the customer receipt runtime from the root type-based controller and route into feature-owned vertical slices while preserving the existing API and runtime behavior.

## Planned Slices

1. Shared policies, normalization, includes, and context helpers
2. Query: receipt list/search
3. Query: customer search
4. Query: receipt detail
5. Query: allocation candidates
6. Create receipt
7. Allocate receipt
8. Cancel receipt
9. Canonical module route and server mount
10. Remove legacy root controller and route only after all runtime ownership is transferred

## Compatibility Contract

- Preserve `/api/customer-receipts` endpoints and HTTP methods
- Preserve `traceVerifyToken` and `verifyToken`
- Preserve branch and employee context behavior
- Preserve status codes, response shapes, messages, transaction boundaries, and sale-payment projection behavior
- No Prisma schema or migration changes
- No business rule redesign during structural migration

## Batch Policy

- One branch and one Draft PR for this domain migration
- Commit each reversible sub-slice independently
- Keep the PR Draft until the aggregate migration is ready for one deployment
- Runtime and operational evidence remain separate from repository verification

## Status

Working area initialized. Implementation has not yet changed production runtime ownership.
