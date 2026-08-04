# Product Template Candidate Grouping Authority

## Goal
Reduce duplicate Superadmin review by grouping unmatched Store Products before Candidate persistence.

## Authority
- Business workspace resolves the canonical Template Branch.
- Template Branch category scopes real Store Branches.
- Product ownership is resolved through `Product.productType.branchId`.
- Candidate grouping uses normalized Brand + normalized Product name.
- Product Type is review evidence, not part of the grouping key.

## Group review status
- `READY`: every source Product has the same single `globalProductTypeId`.
- `PRODUCT_TYPE_REVIEW_REQUIRED`: Product Type is missing or conflicting within the same group.

## Runtime behavior
- Discovery Audit returns `groupSummary` and `groups` in addition to per-Product evidence.
- Discovery Materialize returns `GROUPED_DRY_RUN` and previews READY groups.
- `apply: true` is blocked with `GROUPED_CANDIDATE_MATERIALIZATION_NOT_ENABLED` until grouped persistence and lifecycle authority are approved.

## Safety
- No migration.
- No Candidate creation.
- No Product, Template, stock, price, serial, or transaction mutation.
