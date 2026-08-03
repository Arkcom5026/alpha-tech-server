# ProductTemplate Candidate Runtime Slice 1

## Goal

Deliver the first real backend capability for the platform-governed flow:

`Store Product -> ProductTemplateCandidate -> Superadmin review queue`

## Source authority

- Base branch: `feature/product-template-candidate-prisma-foundation`
- Base SHA: `e3a2874fff45728a308a061a6604c061e4b42c8f`
- Production migrations for Product ownership, Brand ownership, and Candidate/Event persistence have already been applied and verified as up to date.

## E2E slice

1. Superadmin submits `sourceProductId`, explicit `sourceBranchId`, and target SYSTEM TEMPLATE Branch.
2. Server verifies SUPERADMIN authority from authenticated `req.user`.
3. Server loads the source Product and catalog relations without price values, stock details, serials, costs, supplier, customer, sales, purchase, tax, repair, claim, reservation, or other operational payloads.
4. Server resolves source ownership read-only:
   - Canonical `Product.branchId` is authoritative when present.
   - When canonical ownership is null, only distinct branch identities from `BranchPrice` and `StockItem` may be used as temporary evidence.
   - Exactly one evidence branch must exist and must match the explicitly supplied `sourceBranchId`.
   - Multiple evidence branches are a cross-store conflict and must be rejected.
   - No evidence is an ownership-missing conflict.
5. Server verifies that the target branch is the approved SYSTEM TEMPLATE workspace; no target is inferred silently.
6. Server writes `ProductTemplateCandidate` and the initial append-only `CREATED` event in one Prisma transaction.
7. Superadmin can list candidates and read candidate detail with events.

## Required HTTP surface

- `POST /api/product-templates/candidates`
- `GET /api/product-templates/candidates`
- `GET /api/product-templates/candidates/:id`

## Responsibility structure

```text
src/modules/productTemplate/candidates/
  shared/
  create/
  query/list/
  query/detail/
  routes/
```

## Locked safety rules

- SUPERADMIN only.
- Source Product is read-only and must never be mutated.
- `sourceBranchId` is explicit input and may never be inferred silently for the caller.
- Canonical `Product.branchId` always overrides fallback evidence.
- Fallback ownership resolution is read-only and does not backfill Product.
- Source and target branches must be distinct.
- Snapshot allowlist only. Never serialize a full Prisma Product object.
- Ownership-resolution mode may be stored as governance metadata, but branch price values, stock rows, serials, and costs must never enter the snapshot.
- Candidate creation and CREATED event are atomic.
- No duplicate uniqueness is invented in this slice; historical candidates remain allowed by schema.
- No promotion, merge, reject, review transition, ProductTemplate mutation, physical asset copy, media copy, Product/Brand backfill, Prisma change, or migration.
- The two active stores remain independent tenants. Any multi-branch evidence is rejected rather than aggregated.

## Verification

- Fixture/contract tests for SUPERADMIN guard and route ownership.
- Pure resolver tests covering canonical, single-branch evidence, mismatch, no evidence, and cross-branch conflict.
- Service tests for snapshot allowlist and source ownership mismatch.
- Repository contract for atomic candidate + CREATED event transaction.
- List/detail projection tests proving forbidden operational fields are absent.
- Existing targeted Prisma migration contract remains unchanged.

## Merge/deploy

Keep Draft. No merge or application deploy until targeted tests and runtime evidence pass.
