# Slice 2 — Tax Module Skeleton

## Status

Repository implementation: COMPLETE
Runtime integration: NOT ENABLED
Prisma impact: NONE
Legacy behavior impact: NONE

## Purpose

Create the first capability-owned Tax module boundary without changing existing sales, procurement, reporting, or printing runtime behavior.

## Added public structure

```text
src/modules/tax/
  contracts/
    taxCandidateContract.js
    taxDocumentContract.js
    taxMoneyContract.js
    index.js
  policies/
    taxAuthorityPolicy.js
    index.js
  shared/
    taxLegacyCompatibility.js
    index.js
  index.js
```

The root public boundary reserves future ownership for controllers, services, repositories, projections, and routes. Those surfaces are intentionally empty until their implementation slices are approved.

## Established contracts

- Supported tax source identities
- Input/output tax direction
- Tax document types and lifecycle states
- Immutable snapshot contract version
- Money normalization and rounding tolerance
- Source-to-direction authority policy
- Explicit legacy compatibility inventory

## Invariants

1. Business modules remain owners of their source transactions.
2. Tax owns tax classification and tax-document semantics.
3. Tax code must not call business controllers.
4. No Prisma model or migration is introduced in this slice.
5. No legacy route is mounted through the new module yet.
6. Existing Sale, PurchaseOrderReceipt, report, and print behavior remains unchanged.
7. Runtime adoption will be additive and guarded by later slices.

## Repository Gate

- Capability-owned module path exists: PASS
- Public exports exist: PASS
- Contracts are dependency-free: PASS
- Prisma untouched: PASS
- Runtime wiring untouched: PASS
- Compatibility boundary declared: PASS

## Next Slice

Slice 3 — Prisma Tax Foundation.

The architect will prepare the additive schema design and Local handoff package. Prisma format, validate, generate, migration execution, database verification, commit, and push remain Local responsibilities.
