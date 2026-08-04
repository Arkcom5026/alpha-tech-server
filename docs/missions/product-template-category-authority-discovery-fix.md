# Product Template Category Authority Discovery Fix

## Goal

Correct Product Template discovery so the UI Business Type selects the SYSTEM TEMPLATE Branch first, then uses that branch's `categoryId` as the real catalog scope for Store Branch discovery.

## Domain authority

1. `businessType` from the UI is a selector, not the final Store Branch filter.
2. Resolve exactly one SYSTEM TEMPLATE Branch using:
   - selected `businessType`
   - `address = SYSTEM TEMPLATE`
   - non-null `branchCode`
3. Use the resolved Template Branch `categoryId` as the Store/Template comparison boundary.
4. Store Branches must share the resolved `categoryId` and must exclude:
   - the resolved Template Branch
   - `SYSTEM TEMPLATE`
   - `SYSTEM TEST ONLY`
5. Never hard-code a Branch ID.

## Safety

- Read-only discovery.
- No Candidate creation.
- No Product linking or mutation.
- No migration.
- No Stock, Serial, Cost, Price, Supplier or transaction projection.

## Verification

`node tests/product-template-category-authority-discovery-fix.contract.test.js`
