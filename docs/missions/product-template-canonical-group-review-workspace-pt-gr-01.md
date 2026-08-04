# PT-GR-01 — Canonical Group Review Workspace

## Goal
Expose a read-only, paginated canonical group projection for the Superadmin Product Template workspace.

## Endpoint
`GET /api/product-templates/candidates/groups`

Required query:
- `businessType`

Optional query:
- `reviewStatus=ALL|READY|PRODUCT_TYPE_REVIEW_REQUIRED`
- `q`
- `page`
- `pageSize`

## Authority
- Business workspace resolves the canonical Template Branch.
- Template Branch category scopes Store Branches.
- Product ownership is resolved through `Product.productType.branchId`.
- Candidate review operates on canonical groups, not individual Store Products.

## Projection
- Template Branch and category evidence
- Group summary
- Search and review-status filters
- Pagination
- Group items ordered by Store coverage and Product coverage

## Safety
Read-only. No Candidate, Product, Template, Product Type, stock, price, serial, or transaction mutation.

## Verification
`node tests/product-template-canonical-group-review-workspace-pt-gr-01.contract.test.js`
