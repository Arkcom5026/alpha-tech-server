# Product Template Business-Type Discovery — Slice 1

## Goal

Establish Business Type as the primary governance boundary for Product Template Candidate review without duplicating Business Type into Candidate persistence.

## Domain authority

- `Branch.businessType` is the source of truth for a store's business domain.
- `ProductTemplateCandidate.sourceBranchId` links a Candidate to that authority.
- Candidate review must be scoped by the source store's Business Type before Product Type, Brand, matching or promotion decisions.
- Platform Templates are convenience knowledge used to accelerate Store Product creation; they do not own stock, price, serial, supplier or transaction data.

## Increment scope

- Add an allowlisted `businessType` query filter to Candidate Queue.
- Validate the filter against the Prisma `BusinessType` enum.
- Project `sourceBranch.businessType` in every Candidate queue item.
- Apply the same Business Type boundary to pagination totals, status summaries and reviewer workload.
- Preserve all current queue filters, search, sorting and tenant-safe catalog projection.
- Add targeted contract coverage.

## Explicitly deferred

- Automatic discovery of unmatched Store Products.
- Template matching or confidence scoring.
- Candidate fingerprint/grouping across stores.
- Candidate creation triggered from Store Product create/update.
- Platform Template management UI.
- Any Prisma schema or migration change.

## Safety

- Read-only queue changes only.
- No Product, Candidate, Branch, Template, stock, price, cost, serial or transaction mutation.
- No raw SQL.
- No cross-Business-Type matching.
- No merge until exact-SHA targeted verification passes.

## Acceptance

- SUPERADMIN can request `/api/product-templates/candidates?businessType=<enum>`.
- Invalid Business Type returns a deterministic 400 error before Prisma query execution.
- Every returned item exposes its source store Business Type.
- Counts and reviewer workload are calculated inside the selected Business Type boundary.
