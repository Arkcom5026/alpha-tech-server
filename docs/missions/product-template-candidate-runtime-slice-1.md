# ProductTemplate Candidate Runtime Slice 1

## Goal

Deliver the first real backend capability for the platform-governed flow:

`Store Product -> ProductTemplateCandidate -> Superadmin review queue`

## Source authority

- Base branch: `feature/product-template-candidate-prisma-foundation`
- Base SHA: `e3a2874fff45728a308a061a6604c061e4b42c8f`
- Production migrations for Product ownership, Brand ownership, and Candidate/Event persistence have already been applied and verified as up to date.

## E2E slice

1. Superadmin submits a source store Product and target SYSTEM TEMPLATE Branch.
2. Server verifies SUPERADMIN authority from authenticated `req.user`.
3. Server loads the source Product and catalog relations without stock, serial, price, cost, supplier, customer, sales, purchase, tax, repair, claim, reservation, or other operational data.
4. Server verifies that the source Product belongs to the supplied independent source Branch.
5. Server verifies that the target branch is the approved SYSTEM TEMPLATE workspace using existing branch semantics; no target is inferred silently.
6. Server writes `ProductTemplateCandidate` and the initial append-only `CREATED` event in one Prisma transaction.
7. Superadmin can list candidates and read candidate detail with events.

## Required HTTP surface

- `POST /api/superadmin/product-template-candidates`
- `GET /api/superadmin/product-template-candidates`
- `GET /api/superadmin/product-template-candidates/:id`

## Responsibility structure

```text
src/modules/product-template-candidate/
  shared/
  create/
    createProductTemplateCandidateContract.js
    createProductTemplateCandidateRepository.js
    createProductTemplateCandidateService.js
    createProductTemplateCandidateController.js
  query/list/
    listProductTemplateCandidatesRepository.js
    listProductTemplateCandidatesService.js
    listProductTemplateCandidatesController.js
  query/detail/
    getProductTemplateCandidateRepository.js
    getProductTemplateCandidateService.js
    getProductTemplateCandidateController.js
  routes/
    productTemplateCandidateRoutes.js
```

## Locked safety rules

- SUPERADMIN only.
- Source Product is read-only and must never be mutated.
- `sourceBranchId` and `sourceProductId` must match the canonical Product ownership relation.
- Product with null ownership is not eligible in this slice; return a deterministic conflict requiring ownership resolution.
- Source and target branches must be distinct.
- Snapshot allowlist only. Never serialize a full Prisma Product object.
- Candidate creation and CREATED event are atomic.
- No duplicate uniqueness is invented in this slice; historical candidates remain allowed by schema. Service may report active candidates but must not silently merge them.
- No promotion, merge, reject, review transition, ProductTemplate mutation, physical asset copy, media copy, Product/Brand backfill, Prisma change, or migration.
- The two active stores remain independent tenants. No cross-store operational projection is permitted.

## Verification

- Fixture/contract tests for SUPERADMIN guard and route ownership.
- Service tests for snapshot allowlist and source ownership mismatch.
- Repository contract for atomic candidate + CREATED event transaction.
- List/detail projection tests proving forbidden operational fields are absent.
- Existing targeted Prisma migration contract remains unchanged.

## Merge/deploy

Keep Draft. No merge or application deploy until targeted tests and runtime evidence pass.
