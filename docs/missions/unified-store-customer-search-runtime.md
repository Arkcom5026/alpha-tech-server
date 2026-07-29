# Unified Store Customer Search Runtime — Execution Mission

## Mission

Add one branch-scoped customer-only lookup contract for Sale and other customer consumers without importing Repair device or intake concerns.

## Authorized Runtime Surface

```text
GET /api/customers/search?q=<keyword>
```

## Required Behavior

1. Require authenticated `branchId`.
2. Search only active `StoreCustomer` rows owned by that branch.
3. Accept one text field without a caller-selected search mode.
4. Numeric queries support partial phone or tax ID search from four digits.
5. Text queries support display name and company name from two characters.
6. Return no more than 20 customer results.
7. Rank exact phone, phone suffix, partial phone, exact name, name prefix, and contains matches predictably.
8. Preserve the existing StoreCustomer response compatibility shape.
9. Preserve legacy `/by-phone`, `/by-name`, and `/me` routes for compatibility.

## Explicit Boundary

This endpoint searches customers only.

It must not search or return:

- purchased devices
- repaired devices
- serial numbers
- IMEI
- repair jobs
- warranty claims
- intake context

Those remain owned by the Repair module through its intake search capability.

## Non-goals

- Sale frontend cutover
- Repair intake search expansion
- Prisma schema or migration changes
- `/customers/me` identity cutover
- production deployment

## Verification Boundary

Repository verification may prove route, query ownership, branch isolation, search fields, and explicit Repair boundary. Runtime and Operational PASS require separate executable evidence.
