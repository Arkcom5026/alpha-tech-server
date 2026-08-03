# ProductTemplate Candidate Review Queue Slice 4

## Stacked authority

- Repository: `Arkcom5026/alpha-tech-server`
- Base branch: `feature/product-template-candidate-promotion-slice-3`
- Required base SHA: `1f7448a1bf59d300d021230ab1d5510d2eeb2d34`
- Slice 3 targeted contract evidence: PASS
- Runtime scope: Backend read/query only
- Prisma/migration scope: forbidden

## Goal

Complete the Superadmin review queue API needed by the future review workspace without changing candidate lifecycle behavior.

## Required capabilities

1. Extend candidate list query with catalog-safe search over candidate id, source Product name, source Branch name/code, and target Template Product name.
2. Add deterministic sorting using an allowlist only.
3. Return summary counts by candidate status for the current queue filter context.
4. Return reviewer workload counts grouped by `reviewedByEmployeeId` for active/terminal review records.
5. Preserve pagination and existing status/source/target filters.
6. Keep all projections catalog/governance-safe.
7. Correct EmployeeProfile projection to the actual schema field `name`; do not use non-existent `firstName` or `lastName` fields.

## HTTP contract

- Existing `GET /api/product-templates/candidates` remains the queue endpoint.
- Supported query parameters:
  - `status`
  - `sourceBranchId`
  - `targetTemplateBranchId`
  - `reviewedByEmployeeId`
  - `q`
  - `sortBy` = `createdAt | updatedAt | reviewedAt | promotedAt | id`
  - `sortOrder` = `asc | desc`
  - `page`
  - `pageSize`
- Response adds:
  - `summary.byStatus`
  - `summary.totalMatching`
  - `reviewerWorkload[]`

## Safety rules

- SUPERADMIN only.
- Read-only Prisma operations only.
- No candidate/Product/Branch/Employee mutation.
- No stock, price, cost, serial, supplier, customer, sales, purchase, tax, repair, claim, reservation, or media projection.
- No free-form Prisma orderBy keys.
- Search length is bounded and normalized.
- No raw SQL.

## Verification

- Targeted static/contract test for query allowlists, projection safety, summary/workload shape, read-only boundary, and actual EmployeeProfile field names.
- Exact-SHA detached worktree execution.
- No database connection is required for the targeted contract test.
