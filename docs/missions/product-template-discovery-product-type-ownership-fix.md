# Product Template Discovery Product-Type Ownership Fix

## Runtime evidence

Candidate Discovery successfully resolved `IT -> T01 -> categoryId 1` but returned `eligibleCount: 0`, despite real IT stores having many Products outside the platform Template catalog.

## Root cause

Discovery queried Product ownership through `Product.branchId`. Existing Product and Product Template runtime authority stores the owning Branch through `Product.productType.branchId`.

## Correct authority

```text
Business Type workspace
-> canonical Template Branch code
-> Template Branch categoryId
-> Store Branch ids in the same category
-> Product.productType.branchId ownership scope
-> Template comparison
```

## Change

- Find Store Products through `productType.branchId IN storeBranchIds`.
- Find Template Products through `productType.branchId = templateBranchId`.
- Select the ownership Branch through `productType.branch`.
- Report Candidate source and matched Template branch evidence from ProductType ownership.
- Remove reliance on `Product.branchId` from Candidate Discovery.

## Safety

- Read-only Discovery correction.
- No migration.
- No Product, Candidate, Template, stock, price, serial, or transaction mutation.
- Materialization remains dry-run unless `apply: true` is explicitly supplied.

## Verification

```text
node tests/product-template-discovery-product-type-ownership-fix.contract.test.js
```
